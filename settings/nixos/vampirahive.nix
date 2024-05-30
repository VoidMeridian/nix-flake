{
  config,
  pkgs,
  inputs,
  ...
}: {
  imports = [
    ../vampirahive.nix
  ];
  config.hardware.openrazer.enable = true;
  config.services.razer-laptop-control.enable = true;
  config.users.users.vampira.extraGroups = config.users.users.vampira.extraGroups ++ "openrazer";

  # config.extraGroups = ["openrazer"];
  config.security.sudo.extraConfig = ''
    vampira ALL = NOPASSWD: ${config.services.razer-laptop-control.package}/libexec/daemon
  '';

  config.extraPackages = with pkgs; let
    razerdaemon = pkgs.writeScriptBin "razerdaemon" ''
      sudo ${config.services.razer-laptop-control.package}/libexec/daemon
    '';
  in [
    openrazer-daemon
    razergenie
    razerdaemon
    inputs.razer-laptop-control.packages.x86_64-linux.default
  ];
}
