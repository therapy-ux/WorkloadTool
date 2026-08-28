# Publishing this from the GitHub website

No GitHub Desktop, no command line, no build step. The site is already built and sitting
in the `docs` folder.

---

## 1. Make an empty repository

On **github.com** → **+** (top right) → **New repository**.

* Name it whatever you like, e.g. `home-recovery-coordinator`
* Leave **Add a README**, **.gitignore** and **license** all **unticked**
* Click **Create repository**

## 2. Upload the files

On the new empty repo page, click **uploading an existing file**
(or **Add file → Upload files**).

Open this folder on your computer, select **everything inside it**, and drag it into the
browser window. Then click **Commit changes**.

> Windows hides folders whose names start with a dot, so `.github` and `.gitignore` will
> not come across. **That is fine** — this version does not need them.

## 3. Turn the site on

**Settings → Pages**, then set:

* **Source:** `Deploy from a branch`
* **Branch:** `main` and folder `/docs`
* **Save**

Wait about a minute, refresh the page, and GitHub shows your address:
`https://<your-username>.github.io/<repo-name>/`

## 4. Open the site and paste your four links

The first screen asks for them. Paste each one, click **Test the links**, then
**Save and open the tool**. It will not ask again on that computer.

Each coordinator does this once, on their own machine.

To find the links: open the spreadsheet → **File → Share → Publish to web** → pick a tab →
choose **Comma-separated values (.csv)** → copy the link. One per tab, four in total.

---

## If you ever want changes to the app

Ask for a new build. You will get a new `docs/index.html`; upload it to the same place on
the website and the live site updates. Nothing else needs to be touched.

## Optional: share progress between coordinators

Without this, each person's completed work stays in their own browser. With it, everyone
sees the same picture and the therapist follow-up emails actually send.

Deploy `apps-script/Code.gs` — steps in `docs-src/GOOGLE_SHEETS_SETUP.md`, about five
minutes — then paste the `/exec` URL into the optional field on the setup screen.

## What is public and what is not

The **site** is public: anyone with the address can open it. But it ships with **no links
and no patient data inside it**. A stranger who finds the URL sees the empty setup screen.
Your sheet links live only in the browser of whoever typed them in.

Your published spreadsheets remain readable by anyone who has those links — that is
separate from this app, and unchanged by any of this.
