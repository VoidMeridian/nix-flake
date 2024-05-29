{
  lib,
  config,
  # pkgs,
  outputs,
  modulesPath,
  ...
}: {
  imports = [
    outputs.nixosModules
    (modulesPath + "/installer/scan/not-detected.nix")
  ];
  services.asusd = {
    enable = true;
    enableUserService = true;
  };

  boot.initrd.availableKernelModules = ["nvme" "xhci_pci" "usbhid"];
  boot.initrd.kernelModules = [];
  boot.kernelModules = ["kvm-amd"];
  boot.extraModulePackages = [];

  fileSystems."/" = {
    device = "/dev/disk/by-uuid/c42d1775-777e-4446-950a-4888e5d374aa";
    fsType = "ext4";
  };

  fileSystems."/boot" = {
    device = "/dev/disk/by-uuid/CD7E-108E";
    fsType = "vfat";
    options = ["fmask=0022" "dmask=0022"];
  };

  swapDevices = [
    {device = "/dev/disk/by-uuid/002da025-36af-4566-8219-c50d6559adc1";}
  ];

  # Enables DHCP on each ethernet and wireless interface. In case of scripted networking
  # (the default) this is the recommended approach. When using systemd-networkd it's
  # still possible to use this option, but it's recommended to use it in conjunction
  # with explicit per-interface declarations with `networking.interfaces.<interface>.useDHCP`.
  networking.useDHCP = lib.mkDefault true;
  # networking.interfaces.wlp2s0.useDHCP = lib.mkDefault true;

  nixpkgs.hostPlatform = lib.mkDefault "x86_64-linux";
  hardware.cpu.amd.updateMicrocode = lib.mkDefault config.hardware.enableRedistributableFirmware;
  hostname = "wonderland";
  username = "alice";
}
