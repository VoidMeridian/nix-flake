{config, ...}: {
  programs.plasma = {
    enable = true;
    # overrideConfig = true;
    configFile = {
      kcminputrc = {
        "Libinput/1739/52643/1A58201C:00 06CB:CDA3 Touchpad".NaturalScroll = true;
        # Mouse.cursorTheme = "Catppuccin-Mocha-Mauve-Cursors";
      };

      kdeglobals = {
        General = {
          # AccentColor = "78,98,172";
          accentColorFromWallpaper = true;
          fixed = "CaskaydiaCove Nerd Font Mono,10,-1,5,400,0,0,0,0,0,0,0,0,0,0,1";
          # font = "CaskaydiaCove Nerd Font Mono,10,-1,5,400,0,0,0,0,0,0,0,0,0,0,1";
          menuFont = "CaskaydiaCove Nerd Font Mono,10,-1,5,400,0,0,0,0,0,0,0,0,0,0,1";
          smallestReadableFont = "CaskaydiaCove Nerd Font Mono,8,-1,5,400,0,0,0,0,0,0,0,0,0,0,1";
          toolBarFont = "CaskaydiaCove Nerd Font Mono,10,-1,5,400,0,0,0,0,0,0,0,0,0,0,1";
        };
        KDE.widgetStyle = "kvantum";
        KScreen.ScreenScaleFactors = "eDP-1=1;";
        WM = {
          # activeBackground = "47,52,63";
          # activeBlend = "47,52,63";
          activeFont = "CaskaydiaCove Nerd Font Mono,10,-1,5,400,0,0,0,0,0,0,0,0,0,0,1";
          # activeForeground = "211,218,227";
          # inactiveBackground = "47,52,63";
          # inactiveBlend = "47,52,63";
          # inactiveForeground = "102,106,115";
        };
      };
      kscreenlockerrc = {
        Daemon = {
          Autolock = false;
          LockOnResume = false;
        };
      };
      kwalletrc.Wallet."First Use" = false;

      kwinrc = {
        Xwayland.Scale = 1.5;
        Plugins.blurEnabled = true;
        Plugins.contrastEnabled = true;
        Plugins.translucencyEnabled = true;
        Desktops.Id_1 = "05f09b00-3c94-4571-a959-9513ce561b74";
        Desktops.Number = 1;
        Desktops.Rows = 1;
        Tiling.padding = 4;
        "Tiling/adb3f583-c86c-5290-b081-8a533402e836".tiles = "{\"layoutDirection\":\"horizontal\",\"tiles\":[{\"width\":0.25},{\"width\":0.5},{\"width\":0.25}]}";
      };
      kwinrulesrc = {
        "1" = {
          Description = "Application settings for kitty";
          minsize = "1020,556";
          minsizerule = 2;
          opacityactive = 95;
          opacityactiverule = 2;
          wmclass = "kitty";
          wmclassmatch = 1;
        };
        General = {
          count = 1;
          rules = 1;
        };
      };

      plasma-localerc.Formats.LANG = "en_US.UTF-8";
      plasmarc = {
        Theme.name = "Sweet";
        Wallpapers.usersWallpapers = "/home/${config.username}/bg.png";
      };
    };
    workspace = {
      theme = "Sweet";
      colorScheme = "Sweet";
      cursorTheme = "Catppuccin-Mocha-Mauve-Cursors";
      iconTheme = "candy-icons";
      # lookAndFeel = "Sweet-Ambar-Blue";
      wallpaper = "/home/${config.username}/bg.png";
    };
    # startup = {
    #   startupScript = {
    #     razer = {
    #       text = ''
    #         sudo ${inputs.razer-laptop-control.packages.x86_64-linux.default}/libexec/daemon > /home/vampira/.razerdaemon.log
    #       '';
    #     };
    #   };
    # };
    panels = [
      {
        height = 46;
        lengthMode = "fill";
        location = "bottom";
        alignment = "center";
        hiding = "none";
        floating = true;
        widgets = [
          "org.kde.plasma.kickoff"
          "org.kde.plasma.icontasks"
          "org.kde.plasma.systemtray"
          "org.kde.plasma.digitalclock"
          "org.kde.plasma.showdesktop"
          # "org.kde.plasma.systemmonitor"
          {
            systemMonitor = {
              title = "CPU Usage";
              displayStyle = "org.kde.ksysguard.piechart";
              textOnlySensors = [];
              totalSensors = [];
              sensors = [
                {
                  name = "cpu/all/averageTemperature";
                  color = "36,166,150";
                }
              ];
            };
          }
        ];
      }
    ];
    # systemMonitor = {
    #   opts = {
    #     displayStyle = "org.kde.ksysguard.piechart";
    #     sensors.type = [
    #       {name = "cpu/all/averageTemperature";}
    #     ];
    #   };
    # };
    fonts.general = {
      family = "CaskaydiaCove Nerd Font Mono";
      pointSize = 11;
    };
  };
}
