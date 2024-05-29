{
  lib,
  config,
  ...
}: {
  options.razer = {
    enable = lib.mkEnableOption "Razer";
  };
  options.asus = {
    enable = lib.mkEnableOption "Asus Linux";
  };

  config.services.razer-laptop-control.enable = lib.mkIf config.razer.enable true;
  config.services.asusd = lib.mkIf config.asus.enable {
    enable = true;
    enableUserService = true;
  };
}
