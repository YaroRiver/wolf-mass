# Sheet sync setup

Data hub: Google Sheet **Wolf Mass Data**
https://docs.google.com/spreadsheets/d/1kK2FFrEeDz7D7r303ZARf8-7qejg9pUuKLIpB6qM14A/edit

Tabs: `CheckIns` · `Sessions` · `Sets` · `Engine` · `Health` · `Weekly`.
Claude and ChatGPT read and write it through their Google Sheets / Drive connectors.

## 1. Apps Script endpoint (once, ~5 min, on the Mac)

1. Open the sheet → **Extensions → Apps Script**.
2. Delete everything in `Code.gs`, paste the contents of `sync/Code.gs` from this repo, click **Save**.
3. In the function dropdown pick **setup** → **Run** → Review permissions → choose your account → Advanced → Go to project → Allow.
4. **View → Logs** (or Execution log): copy the line `KEY: ...`.
5. **Deploy → New deployment** → gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - **Deploy** → copy the **Web app URL** (ends with `/exec`).
6. Open the site → **Data → Google Sheet sync** → paste URL and KEY → **Save and test**.
   Then **Send everything on this device** once, so data entered before setup lands in the Sheet.
7. On every other device (phone, Mac) open the site → Data → paste the same URL and KEY → **Pull from Sheet**.

"Anyone" means anyone who has both the URL and the KEY. Without the KEY the endpoint refuses every request.

If you change `Code.gs` later: **Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy**. The URL stays the same.

## 2. iPhone Shortcut: sleep, resting HR, HRV every morning

Shortcuts app → **+** → name it **Wolf Health**. Add these actions in order:

1. **Find Health Samples** — Type: *Sleep Analysis* · Start Date *is in the last* 1 day · Value *is not* In Bed · Value *is not* Awake.
2. **Get Details of Health Samples** — *Duration*.
3. **Calculate Statistics** — *Sum*. (Result = total sleep.)
4. **Convert** — the Sum to *Hours*. If Convert is not offered, use **Calculate**: Sum ÷ 3600 and check the first result against the Health app.
5. **Round Number** — to *Tenths*. → rename the variable to `Sleep`.
6. **Find Health Samples** — Type: *Resting Heart Rate* · Sort by *Start Date* · Order *Latest First* · Limit *1*. → **Get Details** *Value* → variable `RHR`.
7. **Find Health Samples** — Type: *Heart Rate Variability* · Sort by *Start Date* · *Latest First* · Limit *1*. → **Get Details** *Value* → variable `HRV`.
8. **Current Date** → **Format Date** — Custom format `yyyy-MM-dd` → variable `Day`.
9. **Dictionary**:
   - `key` (Text) → your KEY
   - `type` (Text) → `health`
   - `data` (Dictionary) → `date`: Day · `sleepHours`: Sleep · `rhr`: RHR · `hrv`: HRV · `source`: `shortcut`
10. **Get Contents of URL** — URL: your Web app URL · Method: **POST** · Request Body: **File** → the Dictionary.
    (If File is not offered, choose **JSON** and add the same three keys.)
11. Optional: **Show Result** while testing; remove it afterwards.

Run it once by hand and check the `Health` tab.

**Automation:** Shortcuts → Automation → **+** → *Time of Day* 07:30 daily (or *Sleep → Wake Up*) → Run Immediately → action: **Run Shortcut → Wolf Health**.

## 3. How Claude / ChatGPT use it

- Read: `Weekly` for the Sunday close-out, `Health` + `CheckIns` for sleep and recovery trends, `Sets` for progression.
- Write: add a row to `CheckIns`, `Health` or `Sessions` by date when Yaro reports numbers in chat. One row per date; edit the existing row if the date is there.
- The `Weekly` tab is rebuilt by the script on every save and nightly at 04:00. Do not edit it by hand.
