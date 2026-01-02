<?php
namespace VMS_Admin;

if ( ! defined('ABSPATH') ) { exit; }

class API {
  // Option keys / transients
  const TX_JWT      = 'vms_api_jwt_token';
  const TX_JWT_EXP  = 'vms_api_jwt_exp'; // epoch seconds
  const DEBUG_LOG   = 'debug.log';

  public static function base(){ return rtrim(get_option(Settings::OPT_API_URL, ''), '/'); }
  public static function tokenOption(){ return trim(get_option(Settings::OPT_API_TOKEN, '')); } // optional PAT

  // === Token management ===

  protected static function get_cached_jwt(){
    $t = get_transient(self::TX_JWT);
    $exp = (int) get_transient(self::TX_JWT_EXP);
    if ($t && $exp) {
      // renew a bit early (60s skew)
      if ( time() < ($exp - 60) ) return $t;
    }
    return '';
  }

  protected static function set_cached_jwt($jwt){
    // Try to read exp from JWT; fallback 55 minutes
    $exp = 0;
    if (is_string($jwt) && strpos($jwt, '.') !== false) {
      $parts = explode('.', $jwt);
      if (!empty($parts[1])) {
        $payload = json_decode( base64_decode(strtr($parts[1], '-_', '+/')), true );
        if (!empty($payload['exp'])) $exp = (int)$payload['exp'];
      }
    }
    if (!$exp) $exp = time() + (55*60);
    set_transient(self::TX_JWT, $jwt, max(60, $exp - time()));
    set_transient(self::TX_JWT_EXP, $exp, max(60, $exp - time()));
    return $jwt;
  }

  protected static function login_and_cache_jwt(){
    $base = self::base();
    if (empty($base)) return new \WP_Error('vms_api_config', 'API URL is not configured');

    // Prefer PAT if provided in settings (no login required)
    $pat = self::tokenOption();
    if (!empty($pat)) {
      // store a pseudo “non-expiring” token marker so headers() use PAT
      self::set_cached_jwt(''); // clear any JWT cache
      return true;
    }

    $email = trim(get_option(Settings::OPT_API_EMAIL, ''));
    $pass  = get_option(Settings::OPT_API_PASSWORD, '');
    if (!$email || !$pass) return new \WP_Error('vms_api_config', 'API credentials not configured');

    $url  = rtrim($base,'/').'/auth/login';
    self::log_line('API login request', ['url' => $url, 'has_email' => !empty($email)]);
    $args = [
      'method'  => 'POST',
      'headers' => [ 'Accept'=>'application/json', 'Content-Type'=>'application/json' ],
      'timeout' => 20,
      'body'    => wp_json_encode([ 'email'=>$email, 'password'=>$pass ]),
    ];
    $res  = wp_remote_request($url, $args);
    if (is_wp_error($res)) {
      self::log_line('API login wp_error', ['message' => $res->get_error_message()]);
      return $res;
    }

    $code = wp_remote_retrieve_response_code($res);
    $json = json_decode(wp_remote_retrieve_body($res), true);
    self::log_line('API login response', ['code' => $code]);
    if ($code >= 200 && $code < 300 && !empty($json['token'])) {
      self::set_cached_jwt($json['token']);
      return true;
    }
    return new \WP_Error('vms_api_login', 'Login failed', ['code'=>$code,'body'=>$json]);
  }

  protected static function ensure_token(){
    // If settings contain a PAT, we don't need JWT
    if ( self::tokenOption() ) return true;

    $t = self::get_cached_jwt();
    if ($t) return true;

    $login = self::login_and_cache_jwt();
    if (is_wp_error($login)) return $login;
    return true;
  }

  public static function headers(){
    $h = [ 'Accept'=>'application/json', 'Content-Type'=>'application/json' ];
    $pat = self::tokenOption();
    if ($pat) {
      $h['Authorization'] = 'PAT '.$pat;
      return $h;
    }
    $jwt = self::get_cached_jwt();
    if ($jwt) $h['Authorization'] = 'Bearer '.$jwt;
    return $h;
  }

  // === Low-level request with auto-login & retry on 401 ===
  public static function request($method, $path, $body = null){
    $base = self::base();
    if (empty($base)) return new \WP_Error('vms_api_config', 'API URL is not configured');

    // Make sure we have a token (JWT) unless PAT is configured
    $ok = self::ensure_token();
    if (is_wp_error($ok)) return $ok;

    $path = self::normalize_path($path);
    $url = rtrim($base,'/').'/'.ltrim($path,'/');
    $args = [
      'method'  => strtoupper($method),
      'headers' => self::headers(),
      'timeout' => 60,
    ];
    if ($body !== null) $args['body'] = is_string($body) ? $body : wp_json_encode($body);

    self::log_line('API request', ['method' => strtoupper($method), 'url' => $url]);
    if (strtoupper($method) === 'POST' && strpos($url, '/vouchers') !== false && !empty($args['body'])) {
      self::log_line('API request body', ['body' => self::redact_payload($args['body'])]);
    }
    $res  = wp_remote_request($url, $args);
    if (is_wp_error($res)) {
      $msg = $res->get_error_message();
      self::log_line('API request wp_error', ['message' => $msg]);
      if (strpos($msg, 'cURL error 28') !== false) {
        self::log_line('API request retry after timeout');
        $res = wp_remote_request($url, $args);
        if (!is_wp_error($res)) {
          $code = wp_remote_retrieve_response_code($res);
          $body = wp_remote_retrieve_body($res);
          $json = json_decode($body, true);
          self::log_line('API retry response', ['code' => $code]);
          if ($code >= 200 && $code < 300) return $json;
          self::log_line('API retry error body', ['code' => $code, 'body' => $body]);
        }
      }
      return $res;
    }

    $code = wp_remote_retrieve_response_code($res);
    $body = wp_remote_retrieve_body($res);
    $json = json_decode($body, true);
    self::log_line('API response', ['code' => $code]);

    // If unauthorized, try to login once and retry (JWT mode only)
    if ($code === 401 && ! self::tokenOption() ) {
      self::set_cached_jwt(''); // clear
      $re = self::login_and_cache_jwt();
      if (!is_wp_error($re)) {
        $args['headers'] = self::headers();
        $res  = wp_remote_request($url, $args);
        if (!is_wp_error($res)) {
          $code = wp_remote_retrieve_response_code($res);
          $body = wp_remote_retrieve_body($res);
          $json = json_decode($body, true);
          self::log_line('API retry response', ['code' => $code]);
          if ($code >= 200 && $code < 300) return $json;
          self::log_line('API retry error body', ['code' => $code, 'body' => $body]);
        }
      }
    }

    if ($code >= 200 && $code < 300) return $json;
    self::log_line('API error body', ['code' => $code, 'body' => $body]);
    return new \WP_Error('vms_api_error', 'API error', ['code'=>$code,'body'=>$json]);
  }

  protected static function log_line($message, $context = []){
    if (empty($message)) return;
    $line = '[' . gmdate('Y-m-d H:i:s') . '] ' . $message;
    if (!empty($context)) $line .= ' ' . wp_json_encode($context);
    $line .= "\n";
    $path = defined('VMS_ADMIN_PATH') ? VMS_ADMIN_PATH . self::DEBUG_LOG : '';
    if (!$path) return;
    @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
  }

  protected static function redact_payload($body){
    if (is_string($body)) {
      $decoded = json_decode($body, true);
      if (json_last_error() === JSON_ERROR_NONE) $body = $decoded;
    }
    if (!is_array($body)) return $body;
    return self::redact_array($body);
  }

  protected static function redact_array($data){
    if (!is_array($data)) return $data;
    foreach ($data as $key => $value) {
      if (is_array($value)) {
        $data[$key] = self::redact_array($value);
        continue;
      }
      $k = is_string($key) ? strtolower($key) : $key;
      if ($k === 'email' || $k === 'phone' || $k === 'password' || $k === 'token') {
        $data[$key] = '[redacted]';
      }
    }
    return $data;
  }

  protected static function normalize_path($path){
    $path = ltrim((string) $path, '/');
    $base = self::base();
    if (empty($base)) return $path;
    if (preg_match('#/api/v1/?$#', $base) || strpos($base, '/api/v1/') !== false) {
      return $path;
    }
    return 'api/v1/'.$path;
  }

  // === Convenience wrappers (unchanged) ===
  public static function salons(){ return self::request('GET', 'salons'); }
  public static function vouchers($query = []){
    $q = $query ? ('?'.http_build_query($query)) : '';
    return self::request('GET', 'vouchers'.$q);
  }
  public static function voucherByCode($code){ return self::request('GET', 'vouchers/code/'.rawurlencode($code)); }
  public static function redeem($code, $salonId, $notes=''){ return self::request('POST', 'vouchers/'.$code.'/redeem', ['salon_id'=>(int)$salonId, 'notes'=>$notes]); }
  public static function void($code, $notes=''){ return self::request('POST', 'vouchers/'.$code.'/void', ['notes'=>$notes]); }
}
