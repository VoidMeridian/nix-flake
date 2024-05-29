{
  pkgs,
  lib,
  ...
}: let
  buildFirefoxXpiAddon = lib.makeOverridable ({
    stdenv ? pkgs.stdenv,
    fetchurl ? pkgs.fetchurl,
    pname,
    version,
    addonId,
    url,
    sha256,
    meta,
    ...
  }:
    stdenv.mkDerivation {
      name = "${pname}-${version}";

      inherit meta;

      src = fetchurl {inherit url sha256;};

      preferLocalBuild = true;
      allowSubstitutes = true;

      passthru = {inherit addonId;};

      buildCommand = ''
        dst="$out/share/mozilla/extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}"
        mkdir -p "$dst"
        install -v -m644 "$src" "$dst/${addonId}.xpi"
      '';
    });
in {
  dont-accept-webp = buildFirefoxXpiAddon {
    pname = "dont-accept-webp";
    version = "0.9";
    # dontUnpack = true;
    url = "https://addons.mozilla.org/firefox/downloads/file/4191562/dont_accept_webp-0.9.xpi";
    sha256 = "nVF3z96QUjLv3nmqW2F7GjQw+JaYj3A0qM2VTmTSStY=";
    addonId = "dont-accept-webp@jeffersonscher.com";
    meta = with lib; {
      homepage = "https://github.com/jscher2000/dont-accept-webp";
      description = "This extension removes image/webp and/or image/avif from the list of formats Firefox tells sites that it accepts. That discourages many servers from replacing JPEG and PNG images with WebP/AVIF. (But some may send them anyway; they aren't blocked.)";
      license = licenses.mpl20;
      platforms = platforms.all;
    };
  };
}
