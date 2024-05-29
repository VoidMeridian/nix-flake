{
  lib,
  pkgs,
  ...
}: {
  gtk = {
    enable = true;
    catppuccin.enable = true;
    font = lib.mkForce {
      name = "CaskaydiaCove NFM";
      size = 16;
    };
    # theme = lib.mkDefault {
    #   package = pkgs.sweet;
    #   name = "Sweet-Dark";
    # };
    iconTheme = lib.mkForce {
      package = pkgs.candy-icons;
      name = "candy-icons";
    };
    # cursorTheme = lib.mkDefault {
    #   name = "candy-icons";
    # };
  };
}
