{lib, ...}: {
  options.hyprland = {
    enable = lib.mkEnableOption "Hyprland";
  };
}
