<?php

declare(strict_types=1);

namespace Codex\Services;

use Codex\Core\Database;

final class AnthropicService
{
    public function __construct(private readonly string $apiKey)
    {
    }

    public static function makeFromSettings(): ?self
    {
        try {
            $env = trim((string) (getenv('ANTHROPIC_API_KEY') ?: ($_SERVER['ANTHROPIC_API_KEY'] ?? $_ENV['ANTHROPIC_API_KEY'] ?? '')));
            if ($env !== '') {
                return new self($env);
            }
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'anthropic_api_key' LIMIT 1");
            $stmt->execute();
            $key = trim((string) ($stmt->fetchColumn() ?: ''));

            return $key !== '' ? new self($key) : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    public function generate(string $systemPrompt, string $userPrompt, int $maxTokens = 2000): ?array
    {
        try {
            $payload = json_encode([
                'model' => 'claude-sonnet-4-20250514',
                'max_tokens' => $maxTokens,
                'system' => $systemPrompt,
                'messages' => [['role' => 'user', 'content' => $userPrompt]],
            ], JSON_UNESCAPED_UNICODE);

            if (!is_string($payload) || $payload === '') {
                return null;
            }

            $ctx = stream_context_create([
                'http' => [
                    'method' => 'POST',
                    'timeout' => 30,
                    'ignore_errors' => true,
                    'header' => implode("\r\n", [
                        'Content-Type: application/json',
                        'x-api-key: ' . $this->apiKey,
                        'anthropic-version: 2023-06-01',
                    ]),
                    'content' => $payload,
                ],
            ]);

            $raw = @file_get_contents('https://api.anthropic.com/v1/messages', false, $ctx);
            if (!is_string($raw) || trim($raw) === '') {
                return null;
            }
            $json = json_decode($raw, true);
            if (!is_array($json)) {
                return null;
            }
            if (($json['type'] ?? null) === 'error') {
                return null;
            }
            $content = $json['content'] ?? null;
            if (!is_array($content) || !isset($content[0]) || !is_array($content[0])) {
                return null;
            }
            $text = isset($content[0]['text']) ? trim((string) $content[0]['text']) : '';
            if ($text === '') {
                return null;
            }

            return [
                'text' => $text,
                'prompt_tokens' => isset($json['usage']['input_tokens']) ? (int) $json['usage']['input_tokens'] : 0,
                'completion_tokens' => isset($json['usage']['output_tokens']) ? (int) $json['usage']['output_tokens'] : 0,
                'model' => isset($json['model']) ? (string) $json['model'] : 'claude-sonnet-4-20250514',
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    public function parseJsonResponse(string $text): ?array
    {
        $clean = preg_replace('/^```(?:json)?\s*|\s*```$/m', '', trim($text));
        if (!is_string($clean) || trim($clean) === '') {
            return null;
        }
        $decoded = json_decode($clean, true);

        return is_array($decoded) ? $decoded : null;
    }
}
