<?php

declare(strict_types=1);

namespace Codex\Core;

final class Request
{
    /** @var array<string, mixed>|null */
    private ?array $parsedBody = null;

    public function __construct(
        private readonly string $method,
        private readonly string $path,
        /** @var array<string, string> */
        private readonly array $headers,
        /** @var array<string, string> */
        private readonly array $query,
        private readonly string $rawBody,
        /** @var array<string, string> */
        public readonly array $routeParams = [],
    ) {
    }

    /**
     * @param array<string, string> $params
     */
    public function withRouteParams(array $params): self
    {
        return new self(
            $this->method,
            $this->path,
            $this->headers,
            $this->query,
            $this->rawBody,
            array_merge($this->routeParams, $params),
        );
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    /**
     * @return array<string, string>
     */
    public function getQuery(): array
    {
        return $this->query;
    }

    public function getQueryString(string $key, ?string $default = null): ?string
    {
        return isset($this->query[$key]) ? (string) $this->query[$key] : $default;
    }

    /**
     * @return array<string, mixed>
     */
    public function getBody(): array
    {
        if ($this->parsedBody !== null) {
            return $this->parsedBody;
        }
        $trimmed = trim($this->rawBody);
        if ($trimmed === '') {
            $this->parsedBody = [];
            return $this->parsedBody;
        }
        $decoded = json_decode($trimmed, true);
        if (!is_array($decoded)) {
            $this->parsedBody = [];
            return $this->parsedBody;
        }
        /** @var array<string, mixed> $decoded */
        $this->parsedBody = $decoded;
        return $this->parsedBody;
    }

    public function getHeader(string $name): ?string
    {
        $key = strtolower($name);
        return $this->headers[$key] ?? null;
    }

    /**
     * @param array<string, string> $server
     */
    public static function fromGlobals(array $server, string $rawBody = ''): self
    {
        $method = strtoupper($server['REQUEST_METHOD'] ?? 'GET');
        $uri = $server['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH);
        $path = is_string($path) ? $path : '/';
        if ($path !== '/' && str_ends_with($path, '/')) {
            $path = rtrim($path, '/') ?: '/';
        }

        $headers = self::parseHeaders($server);
        $query = [];
        if (isset($server['QUERY_STRING']) && $server['QUERY_STRING'] !== '') {
            parse_str($server['QUERY_STRING'], $query);
        } elseif (isset($server['REQUEST_URI'])) {
            $q = parse_url((string) $server['REQUEST_URI'], PHP_URL_QUERY);
            if (is_string($q)) {
                parse_str($q, $query);
            }
        }

        return new self($method, $path, $headers, $query, $rawBody);
    }

    /**
     * @param array<string, string> $server
     * @return array<string, string>
     */
    private static function parseHeaders(array $server): array
    {
        $headers = [];
        foreach ($server as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$name] = (string) $value;
            }
        }
        if (isset($server['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $server['CONTENT_TYPE'];
        }
        if (isset($server['CONTENT_LENGTH'])) {
            $headers['content-length'] = (string) $server['CONTENT_LENGTH'];
        }
        return $headers;
    }
}
