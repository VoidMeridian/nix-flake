{lib, ...}: {
  imports = [../wonderland.nix];
  config.services.asusd = {
    enable = true;
    enableUserService = true;
  };
  config.services.udev.extraRules = ''
    KERNEL=="hidraw*", ATTRS{idVendor}=="3434", ATTRS{idProduct}=="0370", MODE="0766"
  '';
  config.boot.loader.grub.useOSProber = true;
  config.hardware.nvidia.prime.amdgpuBusId = lib.mkForce "PCI:64:0:0";
}
