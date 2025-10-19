# 🚀 QUICK START GUIDE

## Start Everything (One Command)
```bash
./start-all.sh
```

## Access URLs
- **Desktop**: https://lilianna-sweltering-kristopher.ngrok-free.dev/desktop
- **Mobile**: https://lilianna-sweltering-kristopher.ngrok-free.dev/mobile

## Quick Demo (30 seconds)
1. Open both URLs above
2. Mobile: Click "Start"
3. Mobile: Click "🧪 Test Emergency Call"
4. Mobile: Click "Accept"
5. Desktop: Watch video feed appear with AI analysis!

## Stop Everything
```bash
./stop-all.sh
```

## Troubleshooting
If desktop shows "ERR_NGROK_8012":
```bash
./start-all.sh
```

If services crash, check logs:
```bash
tail -f /tmp/frontend.log
tail -f /tmp/node-server.log
tail -f /tmp/python-service.log
```

## Emergency Reset
```bash
./stop-all.sh
sleep 3
./start-all.sh
```

That's it! 🎉
