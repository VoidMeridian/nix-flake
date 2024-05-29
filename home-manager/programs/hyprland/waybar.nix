{
  pkgs,
  lib,
  config,
  ...
}: let
  enable = config.hyprland.enable;
in {
  programs.waybar = {
    enable = lib.mkIf enable true;
    systemd.enable = true;
    # catppuccin = {
    #   enable = true;
    # };
    settings = {
      mainBar = {
        layer = "top";
        position = "bottom";
        output = "eDP-1";
        height = 55;
        spacing = 10;
        modules-left = ["battery" "clock"];
        modules-center = ["temperature" "mpd"];
        modules-right = ["pulseaudio" "memory" "tray"];
        tray = {
          icon-size = 30;
          spacing = 20;
        };
        battery = {
          states = {
            good = 80;
            warning = 30;
            critical = 15;
          };
          interval = 5;
          bat = "BAT0";
          format = "{icon} {capacity}%";
          format-charging = "󱐋 {capacity}%";
          format-plugged = " {capacity}%";
          format-alt = "{icon} {time}";
          format-icons = ["󰁻" "󰁽" "󰁿" "󰂁" "󰁹"];
        };
        clock = {
          format = "{:%b %d %Y %I:%M %p}";
        };
        temperature = {
          critical-threshold = 100;
          format = "{temperatureC}C";
        };
        pulseaudio = {
          format = "{volume}% {icon} {format_source}";
          format-bluetooth = "{volume}% {icon}󰂯 {format_source}";
          format-bluetooth-muted = " {icon}󰂯 {format_source}";
          format-muted = " {format_source}";
          format-source = "{volume}% 󰍬";
          format-source-muted = "󰍭";
          format-icons = {
            headphone = "";
            default = ["" "" "" "" ""];
          };
          on-click = "${pkgs.alsa-utils}/bin/amixer sset Master toggle";
          on-click-right = "${pkgs.alsa-utils}/bin/amixer sset Capture toggle";
        };
        mpd = {
          format = "{artist:.7} - {album} - {title:.55} ({elapsedTime:%M:%S}/{totalTime:%M:%S}) {volume}% ";
          format-disconnected = "Disconnected";
          format-stopped = "Stopped";
          unknown-tag = "N/A";
          interval = 1;
          on-click = "${pkgs.kitty}/bin/kitty ${pkgs.ncmpcpp}/bin/ncmpcpp";
          on-click-right = "${pkgs.mpc-cli}/bin/mpc toggle";
          on-scroll-up = "${pkgs.mpc-cli}/bin/mpc volume +1";
          on-scroll-down = "${pkgs.mpc-cli}/bin/mpc volume -1";
          tooltip-format = "MPD (connected)";
          tooltip-format-disconnected = "MPD (disconnected)";
        };
      };
    };
    style = ''
          @define-color rosewater #f5e0dc;
      @define-color flamingo #f2cdcd;
      @define-color pink #f5c2e7;
      @define-color mauve #cba6f7;
      @define-color red #f38ba8;
      @define-color maroon #eba0ac;
      @define-color peach #fab387;
      @define-color yellow #f9e2af;
      @define-color green #a6e3a1;
      @define-color teal #94e2d5;
      @define-color sky #89dceb;
      @define-color sapphire #74c7ec;
      @define-color blue #89b4fa;
      @define-color lavender #b4befe;
      @define-color text #cdd6f4;
      @define-color subtext1 #bac2de;
      @define-color subtext0 #a6adc8;
      @define-color overlay2 #9399b2;
      @define-color overlay1 #7f849c;
      @define-color overlay0 #6c7086;
      @define-color surface2 #585b70;
      @define-color surface1 #45475a;
      @define-color surface0 #313244;
      @define-color base #1e1e2e;
      @define-color mantle #181825;
      @define-color crust #11111b;
          * {
            color: @text;
          }
          window#waybar {
            background-color: shade(@base, 0.9);
            border: 2px solid alpha(@crust, 0.3);
            opacity: 0.5;
          }
    '';
  };
}
