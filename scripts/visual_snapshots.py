"""Browser-preview smoke tests and reproducible screenshots.

These are snapshots of the interactive browser companion preview, not iOS simulator captures.
Use `--verify` to compare pixel output against the checked-in snapshots.
"""
from pathlib import Path
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
import argparse
import io
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from functools import partial

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'docs'/'screenshots'
BASE.mkdir(parents=True,exist_ok=True)

def assert_image(current:bytes,baseline:Path):
    if not baseline.exists():
        raise AssertionError(f'Missing baseline: {baseline}')
    a=Image.open(io.BytesIO(current)).convert('RGB')
    b=Image.open(baseline).convert('RGB')
    assert a.size==b.size,(a.size,b.size)
    diff=ImageChops.difference(a,b)
    bbox=diff.getbbox()
    if bbox:
        from PIL import ImageStat
        mean=sum(ImageStat.Stat(diff).mean)/3
        assert mean<4.5, f'{baseline.name} visual difference too large (mean channel error {mean:.2f}; tolerance 4.5)'

def run(verify:bool):
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT/'docs')))
    thread=Thread(target=server.serve_forever,daemon=True);thread.start()
    base=f'http://127.0.0.1:{server.server_port}'
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox'],executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        phone=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,reduced_motion='reduce')
        page=phone.new_page()
        page.goto(base+'/preview.html')
        page.get_by_text('YOUR PLAY SESSION').wait_for()
        page.locator('#chapter').select_option('2')
        page.locator('#region').select_option('Port Gellhorn')
        assert page.get_by_text('Quick cash: sell stolen cars').count()==1
        assert page.get_by_text('Chapter 3: better vehicle sales').count()==0
        shot(page,'home-mobile.png',verify)
        page.locator('[data-tab="Library"]').click()
        page.get_by_role('searchbox').fill('speedboat')
        assert page.get_by_text('Speedboats: coastal travel picks').count()==1
        page.get_by_role('searchbox').fill('')
        page.get_by_role('button',name='Money',exact=True).click()
        assert page.get_by_text('Quick cash: sell stolen cars').count()==1
        assert page.get_by_text('Chapter 3: better vehicle sales').count()==0
        shot(page,'library-money-mobile.png',verify)
        page.locator('#spoilers').check()
        assert page.get_by_text('Chapter 3: better vehicle sales').count()==1
        page.locator('#spoilers').uncheck()
        page.locator('[data-entry="money-stolen-cars"]').click()
        assert page.get_by_text('SOURCE-LINKED / REPORTED').count()==1
        assert page.get_by_text('PowerPyx — money guide',exact=False).count()==1
        shot(page,'money-guide-mobile.png',verify)
        page.get_by_role('checkbox').first.check()
        assert page.get_by_role('checkbox').first.is_checked()
        page.locator('#bookmark').click()
        page.reload()
        assert page.locator('#chapter').input_value()=='2'
        assert page.locator('#region').input_value()=='Port Gellhorn'
        page.locator('[data-tab="Library"]').click()
        page.get_by_role('button',name='Saved',exact=True).click()
        page.locator('[data-entry="money-stolen-cars"]').click()
        assert page.get_by_role('checkbox').first.is_checked()
        page.locator('[data-tab="Settings"]').click()
        page.locator('#theme').select_option('lucia')
        assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()")=='#15111c'
        shot(page,'lucia-settings-mobile.png',False)
        page.reload()
        assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()")=='#15111c'
        desktop=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,reduced_motion='reduce')
        landing=desktop.new_page()
        landing.goto(base+'/index.html')
        assert landing.get_by_text('COMING SOON · iOS + ANDROID').count()==1
        assert landing.get_by_role('link',name='EXPLORE THE APP PREVIEW').count()==1
        assert landing.get_by_text('Best rides, by use').count()==1
        shot(landing,'landing-desktop.png',verify,full_page=True)
        browser.close()
    server.shutdown()
    print('Visual smoke checks and screenshot ' + ('verification' if verify else 'generation') + ' passed (5 screens)')

def shot(page,name,verify,full_page=False):
    image=page.screenshot(full_page=full_page,animations='disabled')
    path=BASE/name
    if verify:assert_image(image,path)
    else:path.write_bytes(image)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--verify',action='store_true');args=parser.parse_args()
    run(args.verify)
