{
  config,
  pkgs,
  lib,
  ...
}: let
  firefoxAddons = import ./firefoxAddons.nix {
    inherit pkgs lib;
  };
in {
  programs.firefox = {
    enable = true;
    profiles.default = {
      id = 0;
      extensions = with config.nur.repos.rycee.firefox-addons; [
        ublock-origin
        keepassxc-browser
        firefox-color
        firefoxAddons.dont-accept-webp
        don-t-fuck-with-paste
      ];

      bookmarks = [
        {
          name = "Bookmarks";
          toolbar = true;
          bookmarks = [
            {
              name = "PluralKit Dashboard";
              url = "https://dash.pluralkit.me";
            }
            {
              name = "YouTube";
              url = "https://www.youtube.com/";
            }
            {
              name = "Twitch";
              url = "https://www.twitch.tv/";
            }
            {
              name = "Home Manager Option Search";
              url = "https://home-manager-options.extranix.com/";
            }
            {
              name = "C++ Reference";
              url = "https://en.cppreference.com/w/";
            }
            {
              name = "Code Namer";
              url = "https://killercup.github.io/codenamer/";
            }
            {
              name = "CMake tutorial";
              url = "https://cliutils.gitlab.io/modern-cmake/";
            }
            {
              name = "Nix Options";
              url = "https://search.nixos.org/options";
            }
          ];
        }
      ];
      search = {
        engines = {
          "Better Google" = {
            urls = [{template = "https://google.com/search?q={searchTerms}&udm=14";}];
          };
        };
        default = "Better Google";
        force = true;
      };
      settings = {
        "browser.aboutConfig.showWarning" = false;
        "browser.bookmarks.restore_default_bookmarks" = false;
        "browser.display.use_document_fonts" = 0;
        "browser.toolbars.bookmarks.visibility" = "always";
        "font.minimum-size.x-western" = 16;
        "font.name.monospace.x-western" = "CaskaydiaCove Nerd Font Mono";
        "font.name.sans-serif.x-western" = "CaskaydiaCove Nerd Font Mono";
        "font.name.serif.x-western" = "CaskaydiaCove Nerd Font Mono";
        "layout.css.devPixelsPerPx" = "2";
        "media.cache_readahead_limit" = 9999;
        "media.cache_resume_threshold" = 9999;
        "media.encoder.webm.enabled" = false;
        "media.mediasource.enabled" = false;
        "media.mediasource.webm.audio.enabled" = false;
        "media.mediasource.webm.enabled" = false;
        "media.webm.enabled" = false;
        "extensions.autoDisableScopes" = 0;
      };
      userChrome = ''
        #navigator-toolbox { font-family:CaskaydiaCove NFM !important }
      '';
    };
    # profiles.default = {
    #   id = 0;
    #   search = {
    #     default = "Google";
    #     force = true;
    #   };

    #   userChrome = ''
    #     #navigator-toolbox { font-family:CaskaydiaCove NFM !important }
    #   '';
    # };
  };
}
