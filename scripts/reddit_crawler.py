#!/usr/bin/env python3
"""Archive subreddit posts and media using Reddit Data API listings. ex: python3 reddit_crawler.py """
import argparse
from getpass import getpass
from html import unescape
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

SUBREDDIT = "GTA6_playbook"
USER_AGENT = "local:subreddit-media-archive:1.0"
MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif",
                    ".mp4", ".webm", ".mov", ".m4v"}


def request(url, headers=None):
    for attempt in range(4):
        try:
            return urlopen(Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})}),
                           timeout=45)
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise
            retry = error.headers.get("Retry-After", "")
            delay = int(retry) if retry.isdecimal() else 2 ** (attempt + 1)
            if delay > 120:
                raise
            error.close()
            time.sleep(delay)


def listing_posts(subreddit, token):
    for listing in ("top", "new"):
        after = None
        cursors = set()
        while True:
            params = {"limit": 100, "raw_json": 1}
            if listing == "top":
                params["t"] = "all"
            if after:
                params["after"] = after
            url = f"https://oauth.reddit.com/r/{subreddit}/{listing}?" + urlencode(params)
            with request(url, {"Authorization": f"Bearer {token}"}) as response:
                page = json.load(response)["data"]
                remaining = response.headers.get("X-Ratelimit-Remaining")
                reset = response.headers.get("X-Ratelimit-Reset")
            yield from (child["data"] for child in page["children"] if child["kind"] == "t3")
            after = page.get("after")
            if not after:
                break
            if after in cursors:
                raise ValueError(f"Reddit repeated a pagination cursor for {listing}.")
            cursors.add(after)
            delay = max(1, float(reset or 0)) if remaining and float(remaining) < 1 else 1
            time.sleep(delay)


def read_listings(paths):
    for path in paths:
        page = json.loads(path.read_text(encoding="utf-8"))
        yield from (child["data"] for child in page["data"]["children"] if child["kind"] == "t3")


def attachments(post, depth=0):
    if depth > 5:
        return
    gallery = post.get("media_metadata") or {}
    items = (post.get("gallery_data") or {}).get("items", [])
    for item in items:
        source = gallery.get(item.get("media_id"), {}).get("s", {})
        for key in ("mp4", "gif", "u"):
            if source.get(key):
                yield "file", source[key], None
                break

    for container in ("secure_media", "media", "preview"):
        data = post.get(container) or {}
        video = data.get("reddit_video") or data.get("reddit_video_preview") or {}
        if video.get("dash_url") or video.get("fallback_url"):
            yield "video", video.get("dash_url"), video.get("fallback_url")
            break

    url = post.get("url_overridden_by_dest") or post.get("url")
    if url and Path(urlsplit(url).path).suffix.lower() in MEDIA_EXTENSIONS:
        yield "file", url, None
    for parent in post.get("crosspost_parent_list") or []:
        yield from attachments(parent, depth + 1)


def write_json(path, data):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def download(url, target):
    if target.is_file() and target.stat().st_size:
        return
    temporary = target.with_suffix(target.suffix + ".part")
    try:
        with request(url) as response:
            content_type = response.headers.get_content_type()
            if content_type not in ("application/octet-stream", "application/mp4") and not (
                content_type.startswith(("image/", "video/"))
            ):
                raise ValueError(f"Unexpected content type {content_type}")
            with temporary.open("wb") as output:
                shutil.copyfileobj(response, output)
            length = response.headers.get("Content-Length")
            size = temporary.stat().st_size
            if not size or (length and size != int(length)):
                raise ValueError("Incomplete media download")
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def media_url(url):
    if not url:
        return None
    url = unescape(url)
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Media link must be an HTTPS URL without credentials")
    return url


def save_media(folder, index, kind, url, fallback, ffmpeg):
    url, fallback = media_url(url), media_url(fallback)
    if kind == "video":
        target = folder / f"{index:02}.mp4"
        if url and ffmpeg and urlsplit(url).hostname == "v.redd.it":
            if not target.is_file() or not target.stat().st_size:
                temporary = target.with_suffix(".part.mp4")
                try:
                    subprocess.run(
                        [ffmpeg, "-nostdin", "-loglevel", "error", "-y", "-i", url,
                         "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", str(temporary)],
                        check=True, timeout=900,
                    )
                    temporary.replace(target)
                finally:
                    temporary.unlink(missing_ok=True)
            return target.name, "Downloaded from Reddit DASH"
        if not fallback:
            raise ValueError("Reddit supplied only a DASH stream. Install FFmpeg.")
        target = folder / f"{index:02}-video-only.mp4"
        download(fallback, target)
        return target.name, "Fallback video may be silent. Install FFmpeg to capture available audio."

    suffix = Path(urlsplit(url).path).suffix.lower()
    target = folder / f"{index:02}{suffix if suffix in MEDIA_EXTENSIONS else '.media'}"
    download(url, target)
    return target.name, "Downloaded"


def archive(post, root, ffmpeg):
    folder = root / post["id"]
    folder.mkdir(parents=True, exist_ok=True)
    record = {
        "id": post["id"], "title": post.get("title"), "score": post["score"],
        "created_utc": post.get("created_utc"), "body": post.get("selftext"),
        "permalink": "https://www.reddit.com" + post.get("permalink", ""),
        "destination": post.get("url_overridden_by_dest") or post.get("url"),
        "media": [],
    }
    metadata = folder / "post.json"
    write_json(metadata, record)
    failed = 0
    for index, (kind, url, fallback) in enumerate(dict.fromkeys(attachments(post)), 1):
        entry = {"url": url or fallback}
        try:
            entry["file"], entry["status"] = save_media(folder, index, kind, url, fallback, ffmpeg)
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            entry["error"] = str(error)
            print(f"{post['id']} media {index}: {error}", file=sys.stderr)
            failed += 1
        record["media"].append(entry)
    write_json(metadata, record)
    print(f"{post['id']}  score {post['score']}  {post.get('title', '')}")
    return failed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--subreddit", default=SUBREDDIT)
    parser.add_argument("--min-score", type=int, default=50)
    parser.add_argument("--output", type=Path, default=Path(SUBREDDIT + "_archive"))
    parser.add_argument("--listing-json", nargs="+", type=Path, metavar="FILE",
                        help="Read previously saved Reddit listing responses instead of fetching listings.")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_]+", args.subreddit):
        parser.error("Enter the subreddit name without r/.")
    if args.listing_json:
        posts = read_listings(args.listing_json)
    else:
        token = os.environ.get("REDDIT_ACCESS_TOKEN") or (
            getpass("Reddit Data API access token: ") if sys.stdin.isatty() else ""
        )
        if not token.strip():
            parser.error("Supply a Reddit Data API access token or use --listing-json.")
        posts = listing_posts(args.subreddit, token.strip())

    ffmpeg = shutil.which("ffmpeg")
    seen = set()
    failures = 0
    try:
        for post in posts:
            post_id = post["id"]
            if (post.get("subreddit", "").lower() != args.subreddit.lower()
                    or not re.fullmatch(r"[a-z0-9]+", post_id)
                    or post_id in seen or post["score"] < args.min_score):
                continue
            failures += archive(post, args.output, ffmpeg)
            seen.add(post_id)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Stopped after archiving {len(seen)} matching posts: {error}", file=sys.stderr)
        return 1
    print(f"Archived {len(seen)} matching posts. Media download failures: {failures}.")
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(main())
