docker rm -f polymarket-bot 2>/dev/null || true \
&& docker build -t polymarket-bot . \
&& docker run -d --name polymarket-bot -p 3000:3000 --restart=always polymarket-bot