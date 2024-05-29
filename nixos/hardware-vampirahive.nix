{
  config,
  inputs,
  pkgs,
  ...
}: let
  razerdaemon = pkgs.writeScriptBin "razerdaemon" ''
    sudo ${config.services.razer-laptop-control.package}/libexec/daemon
  '';
in {
  hardware.openrazer.enable = true;
  razer.enable = true;
  environment.systemPackages =
    pkgs.environment.systemPackages
    ++ [
      pkgs.openrazer-daemon
      pkgs.razergenie
      razerdaemon
      inputs.razer-laptop-control.packages.x86_64-linux.default
    ];
  hostname = "vampirahive";
  username = "vampira";

  services.razer-laptop-control.enable = true;
  users.users.${config.username}.extraGroups = pkgs.users.users.${config.username}.extraGroups ++ "openrazer";
  security.sudo.extraConfig = ''
    ${config.username} ALL = NOPASSWD: ${config.services.razer-laptop-control.package}/libexec/daemon
  '';
}
