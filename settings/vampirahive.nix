{outputs, ...}: {
  imports = [
    outputs.nixosModules
  ];
  config.hostname = "vampirahive";
  config.username = "vampira";
}
