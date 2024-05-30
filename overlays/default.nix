{
  inputs,
  # outputs,
  # lib,
  # config,
  pkgs,
  ...
}: {
  additions = final: _prev: import ../pkgs {pkgs = final;};
  modifications = final: prev: {
    catpuccin-sddm = prev.catppuccin-sddm.override {
      flavor = "mocha";
      font = "CaskaydiaCove NFM";
      fontSize = "10";
      background = "${../home-manager/bg.png}";
      loginBackground = true;
    };
    openrazer-daemon = prev.openrazer-daemon.overrideAttrs (oldAttrs: {
      nativeBuildInputs = (oldAttrs.nativeBuildInputs or []) ++ [pkgs.gobject-introspection pkgs.wrapGAppsHook3 pkgs.python3Packages.wrapPython];
    });
    catpuccin-kde = prev.catppuccin-kde.override {
      flavor = "mocha";
      accents = "mauve";
      winDecStyles = "modern";
    };
    catpuccin-gtk = prev.catppuccin-gtk.override {
      variant = "mocha";
      accents = "mauve";
    };
    catpuccin-kvantum = prev.catppuccin-kvantum.override {
      variant = "mocha";
      accent = "mauve";
    };
  };
  unstable-packages = final: _prev: {
    unstable = import inputs.nixpkgs;
    system = final.system;
    config.allowUnfree = true;
    config.cudaSupport = false;
    config.allowAliases = true;
    config.rocmSupport = false;
  };
}
