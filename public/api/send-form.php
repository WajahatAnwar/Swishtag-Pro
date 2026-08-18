<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function starts_with(string $value, string $prefix): bool
{
    return substr($value, 0, strlen($prefix)) === $prefix;
}

function ends_with(string $value, string $suffix): bool
{
    if ($suffix === '') {
        return true;
    }
    return substr($value, -strlen($suffix)) === $suffix;
}

function contains_text(string $value, string $needle): bool
{
    return $needle === '' || strpos($value, $needle) !== false;
}

function load_php_config_file(string $path): array
{
    if (!is_readable($path)) {
        return [];
    }

    $config = require $path;
    return is_array($config) ? $config : [];
}

function load_env_file(string $path): void
{
    if (!is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || starts_with($line, '#') || !contains_text($line, '=')) {
            continue;
        }

        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        $existing = getenv($key);
        if ($key === '' || ($existing !== false && $existing !== '')) {
            continue;
        }

        if ((starts_with($value, '"') && ends_with($value, '"')) || (starts_with($value, "'") && ends_with($value, "'"))) {
            $value = substr($value, 1, -1);
        }

        $value = preg_replace_callback('/\$\{([A-Z0-9_]+)\}/', static function (array $matches): string {
            $replacement = getenv($matches[1]);
            return $replacement === false ? '' : $replacement;
        }, $value) ?? $value;

        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

$envPaths = [
    __DIR__ . '/.env',
    dirname(__DIR__) . '/.env',
    dirname(__DIR__, 2) . '/.env',
];
if (!empty($_SERVER['DOCUMENT_ROOT'])) {
    $documentRoot = rtrim((string) $_SERVER['DOCUMENT_ROOT'], '/\\');
    $envPaths[] = $documentRoot . '/.env';
    $envPaths[] = dirname($documentRoot) . '/.env';
}

foreach (array_unique($envPaths) as $envPath) {
    load_env_file($envPath);
}

$privateConfigPaths = [
    dirname(__DIR__, 2) . '/swishtag-mail-config.php',
];
if (!empty($_SERVER['DOCUMENT_ROOT'])) {
    $documentRoot = rtrim((string) $_SERVER['DOCUMENT_ROOT'], '/\\');
    $privateConfigPaths[] = dirname($documentRoot) . '/swishtag-mail-config.php';
}

$privateConfig = [];
foreach (array_unique($privateConfigPaths) as $configPath) {
    $privateConfig = load_php_config_file($configPath);
    if ($privateConfig !== []) {
        break;
    }
}

function env_value(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value === false ? $default : trim((string) $value);
}

function config_value(array $config, string $key, string $envKey, string $default = ''): string
{
    if (array_key_exists($key, $config) && is_scalar($config[$key])) {
        return trim((string) $config[$key]);
    }
    return env_value($envKey, $default);
}

function clean_string($value, int $max = 2000): string
{
    $value = is_scalar($value) ? (string) $value : '';
    $value = str_replace(["\r", "\0"], '', $value);
    $value = trim($value);
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max);
    }
    return substr($value, 0, $max);
}

function normalize_website_url($value): string
{
    $value = clean_string($value, 300);
    if ($value === '') {
        return '';
    }

    if (preg_match('/\s/', $value)) {
        return '';
    }

    if (!preg_match('/^[a-z][a-z0-9+.-]*:\/\//i', $value)) {
        $value = 'https://' . $value;
    }

    $parts = parse_url($value);
    if (!is_array($parts)) {
        return '';
    }

    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = strtolower((string) ($parts['host'] ?? ''));
    if (!in_array($scheme, ['http', 'https'], true) || $host === '' || strpos($host, '.') === false) {
        return '';
    }

    if (filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) === false) {
        return '';
    }

    return $value;
}

function html_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function require_fields(array $data, array $fields): array
{
    $missing = [];
    foreach ($fields as $field) {
        if (clean_string($data[$field] ?? '') === '') {
            $missing[] = $field;
        }
    }
    return $missing;
}

function smtp_read($socket): string
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }
    return $response;
}

function smtp_command($socket, string $command, array $accepted): string
{
    fwrite($socket, $command . "\r\n");
    $response = smtp_read($socket);
    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $accepted, true)) {
        throw new RuntimeException('SMTP command failed with code ' . $code . '.');
    }
    return $response;
}

function render_text_email(array $fields): string
{
    $lines = [];
    foreach ($fields as $label => $value) {
        $lines[] = $label . ': ' . ($value === '' ? '-' : $value);
    }
    return implode("\r\n", $lines);
}

function render_field_row(string $label, string $value): string
{
    $displayValue = $value === '' ? '-' : $value;
    $safeValue = html_escape($displayValue);
    if (filter_var($displayValue, FILTER_VALIDATE_URL)) {
        $safeHref = html_escape($displayValue);
        $safeValue = '<a href="' . $safeHref . '" style="color:#202124;text-decoration:underline;">' . $safeValue . '</a>';
    }

    return '<tr>'
        . '<td style="padding:12px 14px;border-bottom:1px solid #ecece8;color:#6c6e73;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;width:34%;vertical-align:top;">' . html_escape($label) . '</td>'
        . '<td style="padding:12px 14px;border-bottom:1px solid #ecece8;color:#202124;font-size:14px;line-height:1.45;vertical-align:top;">' . nl2br($safeValue) . '</td>'
        . '</tr>';
}

function render_html_email(string $heading, string $summary, array $fields): string
{
    $rows = '';
    foreach ($fields as $label => $value) {
        $rows .= render_field_row((string) $label, (string) $value);
    }

    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;padding:0;background:#f5f5f3;font-family:Arial,Helvetica,sans-serif;color:#202124;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f3;padding:28px 12px;"><tr><td align="center">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #ecece8;border-radius:18px;overflow:hidden;">'
        . '<tr><td style="background:#202124;color:#ffffff;padding:24px 28px;">'
        . '<div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#c2ff02;margin-bottom:10px;">Swishtag Website</div>'
        . '<h1 style="margin:0;font-size:24px;line-height:1.2;font-weight:900;">' . html_escape($heading) . '</h1>'
        . '<p style="margin:10px 0 0;color:#f5f5f3;font-size:14px;line-height:1.5;">' . html_escape($summary) . '</p>'
        . '</td></tr>'
        . '<tr><td style="padding:20px 22px 8px;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #ecece8;border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0;">'
        . $rows
        . '</table>'
        . '</td></tr>'
        . '<tr><td style="padding:14px 28px 26px;color:#6c6e73;font-size:12px;line-height:1.5;">'
        . 'This message was sent from the Swishtag website form. Reply directly to follow up with the lead.'
        . '</td></tr>'
        . '</table>'
        . '</td></tr></table>'
        . '</body></html>';
}

function smtp_send_mail(array $config, string $to, string $subject, string $textBody, string $htmlBody, string $replyTo): void
{
    $host = $config['host'];
    $port = (int) $config['port'];
    $username = $config['username'];
    $password = $config['password'];
    $fromAddress = $config['from_address'];
    $fromName = $config['from_name'];
    $encryption = strtolower($config['encryption']);
    $transportHost = $encryption === 'ssl' ? 'ssl://' . $host : $host;

    $socket = fsockopen($transportHost, $port, $errno, $errstr, 20);
    if (!$socket) {
        throw new RuntimeException('Could not connect to mail server.');
    }

    stream_set_timeout($socket, 20);

    try {
        $greeting = smtp_read($socket);
        if ((int) substr($greeting, 0, 3) !== 220) {
            throw new RuntimeException('Mail server did not accept connection.');
        }

        smtp_command($socket, 'EHLO swishtag.com', [250]);

        if ($encryption === 'tls' || $encryption === 'starttls') {
            smtp_command($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Could not start TLS.');
            }
            smtp_command($socket, 'EHLO swishtag.com', [250]);
        }

        smtp_command($socket, 'AUTH LOGIN', [334]);
        smtp_command($socket, base64_encode($username), [334]);
        smtp_command($socket, base64_encode($password), [235]);
        smtp_command($socket, 'MAIL FROM:<' . $fromAddress . '>', [250]);
        smtp_command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
        smtp_command($socket, 'DATA', [354]);

        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $safeFromName = addcslashes($fromName, "\\\"");
        $boundary = 'swishtag_' . bin2hex(random_bytes(12));
        $headers = [
            'From: "' . $safeFromName . '" <' . $fromAddress . '>',
            'To: <' . $to . '>',
            'Subject: ' . $encodedSubject,
            'Reply-To: <' . $replyTo . '>',
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
            'X-Mailer: Swishtag Website Form'
        ];

        $messageBody = [
            '--' . $boundary,
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            rtrim(chunk_split(base64_encode($textBody))),
            '--' . $boundary,
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            rtrim(chunk_split(base64_encode($htmlBody))),
            '--' . $boundary . '--',
            '',
        ];

        $message = implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $messageBody);
        $message = preg_replace('/^\./m', '..', $message) ?? $message;
        smtp_command($socket, $message . "\r\n.", [250]);
        smtp_command($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'message' => 'This endpoint only accepts form submissions.']);
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$rawBody = file_get_contents('php://input') ?: '';
$data = [];

if (stripos($contentType, 'application/json') !== false) {
    $decoded = json_decode($rawBody, true);
    if (is_array($decoded)) {
        $data = $decoded;
    }
} else {
    $data = $_POST;
}

if (!is_array($data) || $data === []) {
    respond(400, ['ok' => false, 'message' => 'Please complete the form and try again.']);
}

$source = clean_string($data['form_source'] ?? $data['source'] ?? '', 80);
$honeypot = clean_string($data['nickname'] ?? $data['_gotcha'] ?? '', 120);
if ($honeypot !== '') {
    respond(200, ['ok' => true, 'message' => 'Thanks. Your request has been received.']);
}

$allowedSources = ['book-demo', 'custom-software'];
if (!in_array($source, $allowedSources, true)) {
    respond(400, ['ok' => false, 'message' => 'This form could not be verified. Please refresh and try again.']);
}

if ($source === 'book-demo') {
    $required = ['fullName', 'workEmail', 'companyName', 'solutionInterest', 'selectedDate', 'selectedTime'];
    $email = clean_string($data['workEmail'] ?? '', 254);
} else {
    $required = ['name', 'email', 'project_type', 'stage', 'problem'];
    $email = clean_string($data['email'] ?? '', 254);
}

if (require_fields($data, $required) !== []) {
    respond(422, ['ok' => false, 'message' => 'Please complete all required fields before submitting.']);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, ['ok' => false, 'message' => 'Please enter a valid work email address.']);
}

$website = '';
if ($source === 'book-demo') {
    $rawWebsite = clean_string($data['website'] ?? '', 300);
    $website = normalize_website_url($rawWebsite);
    if ($rawWebsite !== '' && $website === '') {
        respond(422, ['ok' => false, 'message' => 'Please enter a valid website like google.com or www.google.com.']);
    }
}

$config = [
    'host' => config_value($privateConfig, 'host', 'MAIL_HOST'),
    'port' => config_value($privateConfig, 'port', 'MAIL_PORT', '465'),
    'username' => config_value($privateConfig, 'username', 'MAIL_USERNAME'),
    'password' => config_value($privateConfig, 'password', 'MAIL_PASSWORD'),
    'encryption' => config_value($privateConfig, 'encryption', 'MAIL_ENCRYPTION', 'ssl'),
    'from_address' => config_value($privateConfig, 'from_address', 'MAIL_FROM_ADDRESS'),
    'from_name' => config_value($privateConfig, 'from_name', 'MAIL_FROM_NAME', config_value($privateConfig, 'app_name', 'APP_NAME', 'Swishtag')),
];

if ($config['from_name'] === '' || $config['from_name'] === '${APP_NAME}') {
    $config['from_name'] = config_value($privateConfig, 'app_name', 'APP_NAME', 'Swishtag');
}

$to = config_value($privateConfig, 'to', 'MAIL_TO', 'hello@swishtag.com');
$mailer = config_value($privateConfig, 'mailer', 'MAIL_MAILER', 'smtp');

foreach (['host', 'username', 'password', 'from_address'] as $key) {
    if ($config[$key] === '') {
        respond(500, ['ok' => false, 'message' => 'Mail is not configured yet. Please contact hello@swishtag.com directly.']);
    }
}

if (strtolower($mailer) !== 'smtp') {
    respond(500, ['ok' => false, 'message' => 'Mail is not configured for SMTP.']);
}

if (!filter_var($config['from_address'], FILTER_VALIDATE_EMAIL)) {
    respond(500, ['ok' => false, 'message' => 'Sender email is not configured correctly.']);
}

$toList = array_values(array_filter(array_map('trim', explode(',', $to)), static function (string $item): bool {
    return filter_var($item, FILTER_VALIDATE_EMAIL) !== false;
}));
if ($toList === []) {
    respond(500, ['ok' => false, 'message' => 'Recipient email is not configured.']);
}

$ip = clean_string($_SERVER['REMOTE_ADDR'] ?? 'Unknown', 80);
$userAgent = clean_string($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 300);
$page = clean_string($data['page'] ?? ($_SERVER['HTTP_REFERER'] ?? 'Unknown'), 300);

if ($source === 'book-demo') {
    $subject = 'New book demo request - ' . clean_string($data['companyName'] ?? 'Swishtag website', 120);
    $fields = [
        'Form' => 'Book a Demo',
        'Full name' => clean_string($data['fullName'] ?? '', 160),
        'Work email' => $email,
        'Company' => clean_string($data['companyName'] ?? '', 160),
        'Website' => $website,
        'Solution interest' => clean_string($data['solutionInterest'] ?? '', 180),
        'Service' => clean_string($data['service'] ?? '', 120),
        'Intent' => clean_string($data['intent'] ?? '', 120),
        'Store count' => clean_string($data['storeCount'] ?? '', 80),
        'Selected date' => clean_string($data['selectedDate'] ?? '', 120),
        'Selected time' => clean_string($data['selectedTime'] ?? '', 120),
        'Timezone' => clean_string($data['timezone'] ?? '', 120),
        'Notes' => clean_string($data['notes'] ?? '', 2400),
        'Page' => $page,
        'IP' => $ip,
        'User agent' => $userAgent,
    ];
} else {
    $subject = 'New custom software idea - ' . clean_string($data['name'] ?? 'Swishtag website', 120);
    $fields = [
        'Form' => 'Custom Software & Automation',
        'Name' => clean_string($data['name'] ?? '', 160),
        'Work email' => $email,
        'Project type' => clean_string($data['project_type'] ?? '', 160),
        'Stage' => clean_string($data['stage'] ?? '', 160),
        'Problem' => clean_string($data['problem'] ?? '', 3000),
        'Integrations' => clean_string($data['integrations'] ?? '', 160),
        'Estimated investment' => clean_string($data['budget'] ?? '', 160),
        'Page' => $page,
        'IP' => $ip,
        'User agent' => $userAgent,
    ];
}

$body = render_text_email($fields);
$htmlBody = render_html_email(
    $source === 'book-demo' ? 'New Book Demo Request' : 'New Custom Software Idea',
    $source === 'book-demo'
        ? 'A lead submitted the Book Demo form and selected a meeting slot.'
        : 'A lead submitted the Custom Software & Automation form.',
    $fields
);

try {
    foreach ($toList as $recipient) {
        smtp_send_mail($config, $recipient, $subject, $body, $htmlBody, $email);
    }
} catch (Throwable $exception) {
    error_log('Swishtag form mail error: ' . $exception->getMessage());
    respond(500, ['ok' => false, 'message' => 'We could not send the email right now. Please try again or email hello@swishtag.com directly.']);
}

respond(200, ['ok' => true, 'message' => 'Thanks. Your request has been sent to Swishtag.']);
