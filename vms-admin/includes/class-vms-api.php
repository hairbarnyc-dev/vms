<?php
namespace VMS_Admin;

if ( ! defined('ABSPATH') ) { exit; }

class API {
  // Option keys / transients
  const TX_JWT      = 'vms_api_jwt_token';
  const TX_JWT_EXP  = 'vms_api_jwt_exp'; // epoch seconds

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
    $args = [
      'method'  => 'POST',
      'headers' => [ 'Accept'=>'application/json', 'Content-Type'=>'application/json' ],
      'timeout' => 20,
      'body'    => wp_json_encode([ 'email'=>$email, 'password'=>$pass ]),
    ];
    $res  = wp_remote_request($url, $args);
    if (is_wp_error($res)) return $res;

    $code = wp_remote_retrieve_response_code($res);
    $json = json_decode(wp_remote_retrieve_body($res), true);
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

    $url = rtrim($base,'/').'/'.ltrim($path,'/');
    $args = [
      'method'  => strtoupper($method),
      'headers' => self::headers(),
      'timeout' => 20,
    ];
    if ($body !== null) $args['body'] = is_string($body) ? $body : wp_json_encode($body);

    $res  = wp_remote_request($url, $args);
    if (is_wp_error($res)) return $res;

    $code = wp_remote_retrieve_response_code($res);
    $json = json_decode(wp_remote_retrieve_body($res), true);

    // If unauthorized, try to login once and retry (JWT mode only)
    if ($code === 401 && ! self::tokenOption() ) {
      self::set_cached_jwt(''); // clear
      $re = self::login_and_cache_jwt();
      if (!is_wp_error($re)) {
        $args['headers'] = self::headers();
        $res  = wp_remote_request($url, $args);
        if (!is_wp_error($res)) {
          $code = wp_remote_retrieve_response_code($res);
          $json = json_decode(wp_remote_retrieve_body($res), true);
        }
      }
    }

    if ($code >= 200 && $code < 300) return $json;
    return new \WP_Error('vms_api_error', 'API error', ['code'=>$code,'body'=>$json]);
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
