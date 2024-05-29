{
  lib,
  pkgs,
  config,
  ...
}: let
  enable = config.hyprland.enable;
in {
  imports = [
    ./rofi.nix
    ./waybar.nix
  ];
  wayland.windowManager.hyprland = {
    enable = lib.mkIf enable false;
    xwayland.enable = true;
    package = pkgs.hyprland;
    systemd.enable = true;
    catppuccin.enable = true;
    settings = {
      exec-once = [
        # "dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP"
        "dunst"
        "swaybg -i ~/.bg.png"
        #        "waybar"
        "nm-applet"
        "Discord"
        "steam -silent"
        "xwaylandvideobridge &"
        "keepassxc --keyfile ~/Vault/Database.keyx ~/Vault/Database.kdbx"
        "lxpolkit &"
      ];
      env = [
        "LIBVA_DRIVER_NAME,nvidia"
        "XDG_SESSION_TYPE,wayland"
        # "GBM_BACKEND,nvidia-drm"
        "__GLX_VENDOR_LIBRARY_NAME,nvidia"
        "WLR_NO_HARDWARE_CURSORS,1"
      ];
      input = {
        kb_layout = "us";
        kb_variant = "";
        kb_model = "";
        kb_options = "compose:menu";
        kb_rules = "";
        follow_mouse = "1";
        numlock_by_default = "1";
        touchpad = {
          natural_scroll = "yes";
        };
      };
      gestures = {
        workspace_swipe = "false";
      };
      general = {
        sensitivity = "1.2";
        gaps_in = "0";
        gaps_out = "0";
        border_size = "0";
        "col.active_border" = "$peach";
        "col.inactive_border" = "$base";
      };
      dwindle = {
        pseudotile = "0";
        force_split = "2";
      };
      decoration = {
        active_opacity = "1";
        inactive_opacity = "1";
      };
      animations = {
        enabled = "1";
        animation = [
          "windows,1,2,default"
          "border,1,10,default"
          "fade,0,5,default"
          "workspaces,1,4,default"
        ];
      };
      # monitor = "eDP-1,2560x1440@165,0x0,1";
      monitor = ["HDMI-A-1,1920x1080@180,2560x0,1" "eDP-1,2560x1440@165,0x0,1"];
      workspace = "2,monitor:HDMI-A-1";
      windowrulev2 = [
        "opacity 0.9,class:(kitty)"
        "opacity 0.9,class:(discord)"
        "opacity 0.0 override 0.0 override,class:^(xwaylandvideobridge)$"
        "noanim,class:^(xwaylandvideobridge)$"
        "noinitialfocus,class:^(xwaylandvideobridge)$"
        "maxsize 1 1,class:^(xwaylandvideobridge)$"
        "noblur,class:^(xwaylandvideobridge)$"
      ];
      bind = [
        "SUPER,t,exec,kitty"
        "SUPER,k,killactive"
        "SUPERSHIFT,l,exec,swaylock -f -i ~/.blur.png"
        "SUPER,d,exec,rofi -show drun"

        "SUPERSHIFT,q,exec,hyprctl dispatch exit"
        "SUPERSHIFT,left,movewindow,l"
        "SUPERSHIFT,down,movewindow,d"
        "SUPERSHIFT,up,movewindow,u"
        "SUPERSHIFT,right,movewindow,r"

        "SUPER,1,workspace,1"
        "SUPER,2,workspace,2"
        "SUPER,3,workspace,3"
        "SUPER,4,workspace,4"
        "SUPER,5,workspace,5"
        "SUPER,6,workspace,6"
        "SUPER,7,workspace,7"
        "SUPER,8,workspace,8"
        "SUPER,9,workspace,9"
        "SUPER,0,workspace,10"

        "SUPERSHIFT,1,movetoworkspace,1"
        "SUPERSHIFT,2,movetoworkspace,2"
        "SUPERSHIFT,3,movetoworkspace,3"
        "SUPERSHIFT,4,movetoworkspace,4"
        "SUPERSHIFT,5,movetoworkspace,5"
        "SUPERSHIFT,6,movetoworkspace,6"
        "SUPERSHIFT,7,movetoworkspace,7"
        "SUPERSHIFT,8,movetoworkspace,8"
        "SUPERSHIFT,9,movetoworkspace,9"
        "SUPERSHIFT,0,movetoworkspace,10"

        "SUPER,SPACE,togglefloating"

        "SUPERSHIFT,left,resizeactive,-40 0"
        "SUPERSHIFT,right,resizeactive,40 0"
        "SUPERSHIFT,down,resizeactive,0 40"
        "SUPERSHIFT,up,resizeactive,0 -40"
        "SUPERSHIFT,s,exec,screenshot"
        "SUPER,f,fullscreen,0"
      ];
      bindm = "SUPER,mouse:272,movewindow";
    };
  };

  services.dunst.enable = lib.mkIf enable true;
  programs.swaylock.enable = lib.mkIf enable true;
}
