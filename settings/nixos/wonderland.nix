{...}: {
  imports = [../wonderland.nix];
  config.services.asusd = {
    enable = true;
    enableUserService = true;
  };
  config.services.udev.extraRules = ''
    KERNEL=="hidraw*", ATTRS{idVendor}=="3434", ATTRS{idProduct}=="0370", MODE="0766"
  '';
  config.users.users.alice.initialPassword = "nixos";
}
