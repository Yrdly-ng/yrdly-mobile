"""Read only device identification or explicit screenshot; never enumerates user data."""
import asyncio
import json
import sys
from pathlib import Path
from pymobiledevice3.usbmux import list_devices
from pymobiledevice3.lockdown import create_using_usbmux
from pymobiledevice3.services.screenshot import ScreenshotService

async def main():
    devices = await list_devices()
    if not devices:
        print(json.dumps({'connected': False}))
        return
    async with await create_using_usbmux(autopair=False) as device:
        print(json.dumps({'connected': True, 'model': device.all_values.get('ProductType'), 'ios': device.all_values.get('ProductVersion')}))
        if len(sys.argv) > 1 and sys.argv[1] == 'capture':
            target = Path(__file__).resolve().parents[1] / '.private' / 'ios-reference.png'
            target.parent.mkdir(exist_ok=True)
            async with ScreenshotService(device) as service:
                data = await service.take_screenshot()
                target.write_bytes(data)
            print(f'Saved private reference: {target.name} ({len(data)} bytes)')

try:
    asyncio.run(asyncio.wait_for(main(), timeout=25))
except Exception as error:
    print(f'Device operation unavailable: {type(error).__name__}: {str(error)[:200]}')
    sys.exit(1)
