{lib, ...}: {
  specialisation = {
    performance.configuration = {
      hardware.nvidia.prime.offload.enable = lib.mkForce false;
      hardware.nvidia.prime.offload.enableOffloadCmd = lib.mkForce false;
      hardware.nvidia.prime.sync.enable = lib.mkForce true;
      services.tlp.enable = lib.mkForce false;
    };
    performance-hyprland.configuration = {
      hyprland.enable = true;
      hardware.nvidia.prime.offload.enable = lib.mkForce false;
      hardware.nvidia.prime.offload.enableOffloadCmd = lib.mkForce false;
      hardware.nvidia.prime.sync.enable = lib.mkForce true;
      services.tlp.enable = lib.mkForce false;
    };
    hyprland.configuration = {
      hyprland.enable = true;
    };
  };
}
