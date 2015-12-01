#! /bin/bash
#
# Diffusion youtube avec ffmpeg

# Configurer youtube avec une résolution 720p. La vidéo n'est pas scalée.

VBR="600k"                                    # Bitrate de la vidéo en sortie
FPS="25"                                       # FPS de la vidéo en sortie
QUAL="medium"                                  # Preset de qualité FFMPEG
YOUTUBE_URL="rtmp://a.rtmp.youtube.com/live2"  # URL de base RTMP youtube
#KEY="sunny4817.dh3s-wfe1-tz21-bp5e"
SOURCE="out.mpg"              # Source UDP (voir les annonces SAP)
OUTFLV="test.flv"
#ffmpeg -i "$SOURCE" -vcodec libx264 -preset medium -maxrate 3000k -bufsize 6000k \
#-vf "scale=1280:-1,format=yuv420p" -g 50 -acodec libmp3lame -b:a 128k -ac 2 -ar 44100 out.flv
#ffmpeg \
#   -re -y -i "$SOURCE" -deinterlace \
#    -vcodec libx264 -pix_fmt yuv420p -r 25 -g $(($FPS * 2)) -b:v $VBR \
#    -acodec libmp3lame -ar 44100 -threads 6 -qscale 3 -b:a 64k -bufsize 512k \
#ffmpeg -re -i "$OUTFLV" -codec copy -f flv "$YOUTUBE_URL/$KEY"

#ffmpeg -re -i "$OUTFLV" -vcodec libx264 -preset veryfast -maxrate 3000k \
#-bufsize 6000k -pix_fmt yuv420p -g 50 -acodec libmp3lame -b:a 128k -ac 2 \
#-ar 44100 -f flv "$YOUTUBE_URL/$KEY"
IN_URL=rtsp://104.155.214.170/GACWPNS291O6U46L0SC4
#IN_URL=http://104.155.214.170/HLS/GACWPNS291O6U46L0SC4/HLS.m3u8
#-rtsp_transport tcp -> for rtsp used
#ffmpeg -rtsp_transport tcp -i "$IN_URL" -ac 2 -ar 44100 -f flv "$YOUTUBE_URL/$KEY"
ffmpeg -i "$OUTFLV" -r 30 -vcodec libx264 -pix_fmt yuv420p -g 50 -ac 2 -ar 44100 -f flv "$YOUTUBE_URL/$KEY"
