# Benchmark Group ERP — Google Sheets setup (v9.1)

## 1. Prepare the spreadsheet
1. Open the Google Sheet that should be the ERP system of record.
2. Choose **Extensions → Apps Script**.
3. Replace the script editor contents with `Code.gs` from this project and save.
4. Select `setupBenchmarkERP` and click **Run** once. Approve the requested spreadsheet permissions.
5. Open **Execution log**. Copy the generated `ERP_API_TOKEN` value. The script also creates an initial `admin` login with temporary password `ChangeMe@123`; the login screen forces a password change on first sign-in.
6. Review the generated tabs. The setup creates: Orders, Production, Shipment, Reconciliation, Material_Control, Store, Quality, Merchandising, Planning, ERP_Users, and ERP_Audit_Log. It adds record IDs and timestamps to operational rows so records can be edited/deleted safely.
7. For the dashboard's factory-wise defect analysis, manually add a column named exactly `Defect Type` to the `Quality` tab (do not replace existing headers). This keeps `Code.gs` unchanged while allowing defect categories to be saved and reported.

## 2. Deploy the Web App
1. Click **Deploy → New deployment → Web app**.
2. **Execute as:** Me.
3. **Who has access:** choose an access option permitted by your organisation for your Next.js server to call the app. The token is required by the script regardless.
4. Deploy and copy the URL ending in `/exec`.
5. If you edit Code.gs later, deploy a **new version** of the existing deployment (Deploy → Manage deployments → Edit → New version).

## 3. Configure Next.js
1. Copy `.env.local.example` to `.env.local` in the project root.
2. Set both values:

```env
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
ERP_API_TOKEN=THE_TOKEN_FROM_THE_SETUP_EXECUTION_LOG
```

3. Stop and restart the development server:

```bash
npm install
npm run dev
```

## 4. First login
- Username: `admin`
- Temporary password: `ChangeMe@123`
- The application requires the admin to set a new password (minimum 10 characters) at first login. Change the temporary password immediately and keep it private.
- Manage users by editing the `ERP_Users` tab. To add a user, select `createERPUserFromPrompt` in Apps Script and click Run; complete the prompts. The user must change the temporary password on first login. Never type plaintext passwords directly into the sheet.

## 5. Data flow
- Dashboard and reconciliation read live sheet data. The dashboard compares order quantity against summed production line targets, ranks factory production efficiency, and summarizes quality DHU and defect types by factory.
- Orders, Merchandising, Planning, Material Control, Store, Production, Shipment, and Quality list/save/edit/delete through the server-side `/api/erp` proxy.
- Reports can search and export currently loaded order records.
- New or edited records are written to the appropriate Google Sheet and become visible after refresh.
- The API token stays on the server; do not put it in browser JavaScript or a `NEXT_PUBLIC_` variable.

## Security and operational notes
- The app uses a shared server-to-Apps-Script token and salted SHA-256 password hashes. For a public internet deployment, add stronger session management, role-based authorisation on every write, rate limiting and an audited user-provisioning workflow before production use.
- Google Sheets is the source of truth; if the API is unavailable, the UI shows a connection error rather than confirming that a write succeeded.
- Do not use sample/demo values as live production data. Verify the sheet headers and all records before go-live.
