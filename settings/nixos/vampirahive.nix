{
  config,
  pkgs,
  ...
}: {
  imports = [
    ../vampirahive.nix
  ];
  hardware.openrazer.enable = true;
  config.services.razer-laptop-control.enable = true;

  users.users.${config.username}.extraGroups = ["networkmanager" "wheel" "openrazer"];
  security.sudo.extraConfig = ''
    ${config.username} ALL = NOPASSWD: ${config.services.razer-laptop-control.package}/libexec/daemon
  '';

  config.extraPackages = with pkgs; let
    razerdaemon = pkgs.writeScriptBin "razerdaemon" ''
      sudo ${
        inputs.razer-laptop-control.packages.x86_64-linux.default
      }/libexec/daemon
    '';
  in [
    openrazer-daemon
    razergenie
    razerdaemon
    inputs.razer-laptop-control.packages.x86_64-linux.default
  ];
}
