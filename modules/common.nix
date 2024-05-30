{lib, ...}:
with lib; {
  options.username = mkOption {
    type = types.str;
    default = "ERROR";
  };
  options.hostname = mkOption {
    type = types.str;
    default = "ERROR";
  };
  options.hyprland = {
    enable = mkEnableOption "Hyprland";
  };
}
