<?php

declare(strict_types=1);

namespace Codex\Services;

use Codex\Core\Database;
use PDO;

final class GmailService
{
    public const AUTO_SYNC_INTERVAL_SEC = 300;

    private const BRIEFING_EMAIL_SLOTS = 5;

    public function __construct(private readonly string $accessToken)
    {
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    public function fetchUnread(int $maxResults = 20): ?array
    {
        return $this->fetchListByQuery('is:unread category:primary', $maxResults);
    }

    /**
     * Read Primary tab messages (newest first from list API).
     *
     * @return list<array<string, mixed>>|null
     */
    public function fetchReadPrimary(int $maxResults = 20): ?array
    {
        return $this->fetchListByQuery('category:primary -is:unread', $maxResults);
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    private function fetchListByQuery(string $searchQuery, int $maxResults): ?array
    {
        $maxResults = max(1, min(20, $maxResults));
        $listUrl = 'https://www.googleapis.com/gmail/v1/users/me/messages?' . http_build_query([
            'labelIds' => 'INBOX',
            'q' => $searchQuery,
            'maxResults' => $maxResults,
        ]);

        $list = $this->getJson($listUrl);
        if ($list === null) {
            return null;
        }

        $messages = isset($list['messages']) && is_array($list['messages']) ? $list['messages'] : [];
        if ($messages === []) {
            return [];
        }

        $out = [];
        foreach ($messages as $item) {
            if (!is_array($item) || !isset($item['id'])) {
                continue;
            }
            $id = (string) $item['id'];
            if ($id === '') {
                continue;
            }
            $detailUrl = 'https://www.googleapis.com/gmail/v1/users/me/messages/' . rawurlencode($id) . '?' . http_build_query([
                'format' => 'metadata',
                'metadataHeaders' => ['Subject', 'From', 'Date'],
            ]);
            $detail = $this->getJson($detailUrl);
            if ($detail === null) {
                return null;
            }
            if (!$this->isPrimaryInboxMessage($detail)) {
                continue;
            }
            $normalized = $this->normalise($detail);
            if ($normalized !== null) {
                $out[] = $normalized;
            }
        }

        return $out;
    }

    /**
     * Gmail “Primary” is INBOX without Social / Promotions / Updates / Forums categorization.
     *
     * @param array<string, mixed> $detail Gmail API message resource
     */
    private function isPrimaryInboxMessage(array $detail): bool
    {
        $labelIds = isset($detail['labelIds']) && is_array($detail['labelIds']) ? $detail['labelIds'] : [];
        $nonPrimary = [
            'CATEGORY_SOCIAL',
            'CATEGORY_PROMOTIONS',
            'CATEGORY_UPDATES',
            'CATEGORY_FORUMS',
        ];
        foreach ($nonPrimary as $cat) {
            if (in_array($cat, $labelIds, true)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param array<string, mixed> $message
     * @return array<string, mixed>|null
     */
    public function normalise(array $message): ?array
    {
        $externalId = isset($message['id']) ? (string) $message['id'] : '';
        if ($externalId === '') {
            return null;
        }

        $threadId = isset($message['threadId']) ? (string) $message['threadId'] : null;
        $snippet = isset($message['snippet']) ? trim((string) $message['snippet']) : '';
        if (strlen($snippet) > 120) {
            $snippet = substr($snippet, 0, 120);
        }

        $payload = isset($message['payload']) && is_array($message['payload']) ? $message['payload'] : [];
        $headers = isset($payload['headers']) && is_array($payload['headers']) ? $payload['headers'] : [];
        $subject = $this->findHeader($headers, 'Subject');
        $from = $this->findHeader($headers, 'From') ?? '';
        $dateHeader = $this->findHeader($headers, 'Date');

        $senderName = null;
        $senderEmail = null;
        if ($from !== '') {
            if (preg_match('/^(.+?)\s*<([^>]+)>$/', trim($from), $m) === 1) {
                $senderName = trim($m[1], " \"'");
                $senderEmail = trim($m[2]);
            } else {
                $senderName = null;
                $senderEmail = trim($from);
            }
        }

        $internalDateMs = isset($message['internalDate']) ? (int) $message['internalDate'] : 0;
        $receivedAt = 0;
        if ($dateHeader !== null) {
            $ts = strtotime($dateHeader);
            if ($ts !== false) {
                $receivedAt = $ts;
            }
        }
        if ($receivedAt < 1 && $internalDateMs > 0) {
            $receivedAt = (int) floor($internalDateMs / 1000);
        }
        if ($receivedAt < 1) {
            $receivedAt = time();
        }

        $mimeType = isset($payload['mimeType']) ? (string) $payload['mimeType'] : '';
        $labelIds = isset($message['labelIds']) && is_array($message['labelIds']) ? $message['labelIds'] : [];
        $isUnread = in_array('UNREAD', $labelIds, true);
        $hasAttachment = str_contains(strtolower($mimeType), 'multipart') || in_array('HAS_ATTACHMENT', $labelIds, true);

        return [
            'external_id' => $externalId,
            'thread_id' => $threadId,
            'subject' => $subject,
            'sender_name' => $senderName,
            'sender_email' => $senderEmail,
            'snippet' => $snippet !== '' ? $snippet : null,
            'is_unread' => $isUnread,
            'has_attachment' => $hasAttachment,
            'received_at' => $receivedAt,
            'fetched_at' => time(),
        ];
    }

    /**
     * Fetches Primary tab messages from Gmail and updates the local cache.
     *
     * @return int|null Number of rows written, or null if the API call failed or DB write failed
     */
    public static function fetchAndStore(int $fetchMax, string $accessToken): ?int
    {
        $fetchMax = max(1, min(20, $fetchMax));
        $gmailService = new self($accessToken);
        $unread = $gmailService->fetchUnread($fetchMax);

        if ($unread === null) {
            return null;
        }

        $readFill = [];
        $nUnread = count($unread);
        if ($nUnread < self::BRIEFING_EMAIL_SLOTS) {
            $need = self::BRIEFING_EMAIL_SLOTS - $nUnread;
            $toFetch = min(20, max($need, $need + 5));
            $readCandidates = $gmailService->fetchReadPrimary($toFetch);
            if ($readCandidates === null) {
                $readCandidates = [];
            }
            $seen = [];
            foreach ($unread as $u) {
                $eid = (string) ($u['external_id'] ?? '');
                if ($eid !== '') {
                    $seen[$eid] = true;
                }
            }
            foreach ($readCandidates as $r) {
                if (count($readFill) >= $need) {
                    break;
                }
                $eid = (string) ($r['external_id'] ?? '');
                if ($eid === '' || isset($seen[$eid])) {
                    continue;
                }
                $readFill[] = $r;
            }
        }

        $toStore = array_merge($unread, $readFill);

        $db = Database::getInstance();
        $db->beginTransaction();
        try {
            $db->prepare('DELETE FROM cached_emails')->execute();

            if ($toStore !== []) {
                $stmt = $db->prepare(
                    'INSERT OR REPLACE INTO cached_emails
                     (external_id, thread_id, subject, sender_name, sender_email, snippet,
                      is_unread, has_attachment, received_at, fetched_at)
                     VALUES
                     (:external_id, :thread_id, :subject, :sender_name, :sender_email, :snippet,
                      :is_unread, :has_attachment, :received_at, :fetched_at)',
                );
                foreach ($toStore as $email) {
                    $stmt->execute([
                        'external_id' => (string) ($email['external_id'] ?? ''),
                        'thread_id' => $email['thread_id'] ?? null,
                        'subject' => $email['subject'] ?? null,
                        'sender_name' => $email['sender_name'] ?? null,
                        'sender_email' => $email['sender_email'] ?? null,
                        'snippet' => $email['snippet'] ?? null,
                        'is_unread' => !empty($email['is_unread']) ? 1 : 0,
                        'has_attachment' => !empty($email['has_attachment']) ? 1 : 0,
                        'received_at' => (int) ($email['received_at'] ?? time()),
                        'fetched_at' => (int) ($email['fetched_at'] ?? time()),
                    ]);
                }
            }

            $db->commit();
        } catch (\Throwable) {
            $db->rollBack();

            return null;
        }

        self::setLastSyncUnix(time());

        return count($toStore);
    }

    /**
     * If Google is connected and the last successful sync is older than $staleAfterSeconds, refresh the cache.
     * Failures are silent so the briefing still returns cached data.
     */
    public static function maybeAutoSync(int $staleAfterSeconds = self::AUTO_SYNC_INTERVAL_SEC, int $fetchMax = 20): void
    {
        $staleAfterSeconds = max(60, $staleAfterSeconds);
        $last = self::getLastSyncUnix();
        if ($last > 0 && (time() - $last) < $staleAfterSeconds) {
            return;
        }
        $auth = GoogleAuthService::makeFromSettings();
        if ($auth === null) {
            return;
        }
        $token = $auth->getValidAccessToken();
        if ($token === null) {
            return;
        }
        self::fetchAndStore($fetchMax, $token);
    }

    public static function getLastSyncUnix(): int
    {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'gmail_last_sync_at' LIMIT 1");
        $stmt->execute();
        $raw = $stmt->fetchColumn();
        if ($raw === false || $raw === null || $raw === '') {
            return 0;
        }

        return (int) $raw;
    }

    private static function setLastSyncUnix(int $unix): void
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO settings (key, value, value_type, description, updated_at)
             VALUES (:key, :value, :value_type, :description, unixepoch())
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = unixepoch()',
        );
        $stmt->execute([
            'key' => 'gmail_last_sync_at',
            'value' => (string) $unix,
            'value_type' => 'integer',
            'description' => 'Unix time of last successful Gmail inbox sync',
        ]);
    }

    /**
     * Prefer unread Primary messages; if none, show the latest cached Primary rows (read).
     *
     * @return list<array<string, mixed>>
     */
    public static function loadCachedUnread(int $limit = 5): array
    {
        $limit = max(1, min(50, $limit));
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT * FROM cached_emails
             WHERE is_unread = 1
             ORDER BY received_at DESC
             LIMIT ?',
        );
        $stmt->execute([$limit]);
        /** @var list<array<string, mixed>> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if ($rows !== []) {
            return self::mapCachedEmailRows($rows);
        }

        $stmt2 = $db->prepare(
            'SELECT * FROM cached_emails
             ORDER BY received_at DESC
             LIMIT ?',
        );
        $stmt2->execute([$limit]);
        /** @var list<array<string, mixed>> $fallback */
        $fallback = $stmt2->fetchAll(PDO::FETCH_ASSOC);

        return self::mapCachedEmailRows($fallback);
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    private static function mapCachedEmailRows(array $rows): array
    {
        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'id' => (int) $row['id'],
                'external_id' => (string) $row['external_id'],
                'thread_id' => $row['thread_id'] !== null ? (string) $row['thread_id'] : null,
                'subject' => $row['subject'] !== null ? (string) $row['subject'] : null,
                'sender_name' => $row['sender_name'] !== null ? (string) $row['sender_name'] : null,
                'sender_email' => $row['sender_email'] !== null ? (string) $row['sender_email'] : null,
                'snippet' => $row['snippet'] !== null ? (string) $row['snippet'] : null,
                'is_unread' => ((int) $row['is_unread']) === 1,
                'has_attachment' => ((int) $row['has_attachment']) === 1,
                'received_at' => (int) $row['received_at'],
                'fetched_at' => (int) $row['fetched_at'],
            ];
        }

        return $out;
    }

    /**
     * @param array<string, mixed> $json
     */
    private function getJson(string $url): ?array
    {
        try {
            $ctx = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => 8,
                    'ignore_errors' => true,
                    'header' => "Authorization: Bearer {$this->accessToken}\r\n",
                ],
            ]);
            $raw = @file_get_contents($url, false, $ctx);
            if (!is_string($raw) || trim($raw) === '') {
                return null;
            }
            $json = json_decode($raw, true);
            if (!is_array($json)) {
                return null;
            }
            if (isset($json['error'])) {
                return null;
            }
            return $json;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param list<array<string, mixed>> $headers
     */
    private function findHeader(array $headers, string $target): ?string
    {
        foreach ($headers as $header) {
            if (!is_array($header)) {
                continue;
            }
            $name = isset($header['name']) ? (string) $header['name'] : '';
            if (strcasecmp($name, $target) !== 0) {
                continue;
            }
            $value = isset($header['value']) ? trim((string) $header['value']) : '';
            return $value === '' ? null : $value;
        }
        return null;
    }
}
