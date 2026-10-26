/**
 * Benchmark Group ERP — merged backend (source Code.gs + v10.9 Planning Controls).
 * Existing sheet names and columns are preserved. setupBenchmarkERP() adds missing
 * planning approval sheet and metadata columns without deleting existing rows.
 * IMPORTANT: Keep the API token on the server; deploy/test on a BACKUP first.
 */
/**
 * Benchmark Group ERP - Google Sheets backend
 * Deploy as a Web App (Execute as: Me). Keep ERP_API_TOKEN only in Script Properties
 * and the Next.js server environment; never put it in client-side code.
 */
const ERP_SHEETS = {
  orders: { name: 'Orders', headers: ['Date','Buyer','PO Number','Style','Factory','Order Qty','SMV','Order Minutes','Shipment Date','Status'] },
  production: { name: 'Production', headers: ['Date','Factory','Line','Style','PO','Target','Cutting','Sewing Output','Finishing','FG Qty','Efficiency','Reject','Status'] },
  shipment: { name: 'Shipment', headers: ['Date','PO','Factory','Shipment Plan','Actual Shipment','Carton Qty','ETD','Status'] },
  reconciliation: { name: 'Reconciliation', headers: ['Buyer','Style','PO','Factory','Order Qty','Material Issued','Cut Qty','Sew Qty','Finish Qty','FG Qty','Shipment Qty','Balance','Variance','Status'] },
  material: { name: 'Material_Control', headers: ['Date','PO','Factory','Material Type','Material','Unit','Required Qty','Ordered Qty','Received Qty','Issued Qty','Balance Qty','Supplier','Expected Date','Status'] },
  store: { name: 'Store', headers: ['Date','PO','Factory','GRN Number','Item Type','Item','Unit','GRN Qty','Issue Qty','Balance Qty','Supplier','Received By','Status'] },
  quality: { name: 'Quality', headers: ['Date','PO','Factory','Line','Inspection Type','Checked Qty','Defect Qty','Defect Type','Reject Qty','DHU %','Status'] },
  merchandising: { name: 'Merchandising', headers: ['Date','Buyer','PO Number','Style','Factory','Season','Product','Quantity','Target Date','Status'] },
  planningapprovals: { name: 'Planning_Approvals', headers: ['Request ID','Requested At','Requested By','Factory','PO','Allocation ID','Proposed Line','Proposed Start','Proposed End','Reason','Status','Reviewed By','Reviewed At','Decision Note'] },
  planning: { name: 'Planning', headers: ['Date','Factory','Buyer','PO','Style','Line','Plan Qty','Start Date','End Date','Status'] },
  users: { name: 'ERP_Users', headers: ['Username','Full Name','Role','Password Salt','Password Hash','Active','Must Change Password','Factory Access','Created At','Updated At'] },
  factorySecurity: { name: 'Factory_Security', headers: ['Factory','Module','PIN Salt','PIN Hash','Active','Updated At'] },
  audit: { name: 'ERP_Audit_Log', headers: ['Timestamp','Username','Action','Module','Record ID','Details'] }
};

function doGet(e) {
  try {
    authorize_(e && e.parameter ? e.parameter.token : '');
    const action = String(e && e.parameter && e.parameter.action || 'dashboard').toLowerCase();
    let result;
    if (action === 'dashboard') result = buildDashboard_(e.parameter.from || '', e.parameter.to || '', e.parameter.username || '');
    else if (action === 'reconciliation') result = buildReconciliation_(e.parameter.username || '');
    else if (action === 'list') result = listRecords_(e.parameter.module, e.parameter.username, e.parameter.from || '', e.parameter.to || '');
    else if (action === 'health') result = { ok: true, message: 'Benchmark ERP Sheets API is ready', time: new Date().toISOString() };
    else throw new Error('Unsupported GET action: ' + action);
    return json_({ ok: true, ...result });
  } catch (err) { return json_({ ok: false, error: message_(err) }); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e && e.postData && e.postData.contents || '{}');
    authorize_(body.token);
    const action = String(body.action || '').toLowerCase();
    let result;
    if (action === 'login') result = login_(body);
    else if (action === 'changepassword') result = changePassword_(body);
    else if (action === 'verifyfactorypin') result = verifyFactoryPin_(body);
    else if (action === 'planningmove') result = planningMove_(body);
    else if (action === 'planningrequest') result = planningRequest_(body);
    else if (action === 'planningreview') result = planningReview_(body);
    else if (action === 'save') result = planningLocked_(() => saveRecord_(body));
    else if (action === 'delete') result = planningLocked_(() => deleteRecord_(body));
    else if (action === 'list') result = listRecords_(body.module, body.username, body.from || '', body.to || '');
    else if (action === 'dashboard') result = buildDashboard_(body.from || '', body.to || '', body.username || '');
    else if (action === 'reconciliation') result = buildReconciliation_(body.username || '');
    else throw new Error('Unsupported POST action: ' + action);
    return json_({ ok: true, ...result });
  } catch (err) { return json_({ ok: false, error: message_(err) }); }
}

function setupBenchmarkERP() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(ERP_SHEETS).forEach(key => ensureSheet_(ss, ERP_SHEETS[key].name, ERP_SHEETS[key].headers));
  Object.keys(ERP_SHEETS).filter(key => !['users','audit','factorySecurity'].includes(key)).forEach(key => ensureRecordMetadata_(ss.getSheetByName(ERP_SHEETS[key].name)));
  setupFactoryCapacitySheet_(ss);
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('ERP_API_TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('ERP_API_TOKEN', token);
    Logger.log('Copy this ERP_API_TOKEN into the server .env.local only: ' + token);
  }
  ensureDefaultAdmin_();
  Logger.log('ERP_API_TOKEN is configured in Script Properties. Keep it secret; rotate if previously exposed.');
  Logger.log('Setup complete. Deploy as Web App and configure .env.local.');
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  const current = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  headers.forEach(h => { if (current.indexOf(h) === -1) { sh.getRange(1, sh.getLastColumn() + 1).setValue(h); current.push(h); } });
  const last = sh.getLastColumn();
  sh.getRange(1, 1, 1, last).setFontWeight('bold').setBackground('#102b60').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  return sh;
}

function ensureRecordMetadata_(sh) {
  ['Record ID','Created At','Updated At'].forEach(h => { const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); if(headers.indexOf(h)===-1) sh.getRange(1,sh.getLastColumn()+1).setValue(h); });
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); const idCol=headers.indexOf('Record ID')+1, createdCol=headers.indexOf('Created At')+1, updatedCol=headers.indexOf('Updated At')+1;
  for(let row=2;row<=sh.getLastRow();row++){ if(!sh.getRange(row,idCol).getValue()) sh.getRange(row,idCol).setValue(Utilities.getUuid()); if(!sh.getRange(row,createdCol).getValue()) sh.getRange(row,createdCol).setValue(new Date()); if(!sh.getRange(row,updatedCol).getValue()) sh.getRange(row,updatedCol).setValue(new Date()); }
}

function ensureDefaultAdmin_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.users.name);
  const rows = records_(sh);
  if (rows.some(r => String(r.Username).toLowerCase() === 'admin')) return;
  const temporaryPassword = PropertiesService.getScriptProperties().getProperty('ERP_BOOTSTRAP_ADMIN_PASSWORD');
  if (!temporaryPassword || temporaryPassword.length < 14) throw new Error('Set a unique ERP_BOOTSTRAP_ADMIN_PASSWORD (14+ characters) in Script Properties before first setup; remove the property after successful setup.');
  const salt = Utilities.getUuid();
  appendObject_(sh, { Username: 'admin', 'Full Name': 'ERP Administrator', Role: 'Admin', 'Password Salt': salt, 'Password Hash': hashPassword_(temporaryPassword, salt), Active: true, 'Must Change Password': true, 'Created At': new Date(), 'Updated At': new Date() });
  PropertiesService.getScriptProperties().deleteProperty('ERP_BOOTSTRAP_ADMIN_PASSWORD');
  Logger.log('Initial admin user created; change bootstrap password immediately upon sign in.');
}

function authorize_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('ERP_API_TOKEN');
  if (!expected || !provided || String(provided) !== expected) throw new Error('Unauthorized API request. Check ERP_API_TOKEN in Apps Script and .env.local.');
}
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function message_(err) { return err && err.message ? err.message : String(err); }
function key_(v) { return String(v || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); }
function num_(v) { const n = Number(String(v == null || v === '' ? 0 : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
function active_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v) === '1' || String(v).toLowerCase() === 'yes'; }

function getSheet_(module) {
  const key = String(module || '').toLowerCase();
  const def = ERP_SHEETS[key];
  if (!def || ['users','audit','factorysecurity'].includes(key)) throw new Error('Invalid or restricted module: ' + key);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.name);
  if (!sh) throw new Error('Sheet not found: ' + def.name + '. Run setupBenchmarkERP() first.');
  return sh;
}
function records_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const headers = data.shift().map(String);
  return data.map((row, idx) => {
    const obj = { _rowNumber: idx + 2 };
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(o => Object.keys(o).some(k => k !== '_rowNumber' && o[k] !== '' && o[k] != null));
}
function listRecords_(module, username, fromDate, toDate) {
  const key = String(module || '').toLowerCase();
  if (key === 'planningapprovals') { const sh=getSheet_(key); const user=findERPUser_(username); let rows=records_(sh); if(String(user.Role||'').toLowerCase()!=='admin') { const allowed=String(user['Factory Access']||'').split(/[;,]/).map(x=>x.trim().toLowerCase()); rows=rows.filter(r=>allowed.includes(String(r.Factory||'').toLowerCase())); } return {module:key,records:rows,lastUpdated:new Date().toISOString()}; }
  if (key === 'users') { const requester=findERPUser_(username); if (String(requester.Role || '').trim().toLowerCase() !== 'admin') throw new Error('Only an ERP Admin can view the user directory.'); const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.users.name); const records=records_(sh).map(publicUser_); return { module:key, records, lastUpdated:new Date().toISOString() }; }
  const sh = getSheet_(key);
  let rows = records_(sh);
  // Factory scoping applies to every factory-bearing module, not only Production and Quality.
  if (key !== 'users') {
    const user = findERPUser_(username);
    if (String(user.Role || '').trim().toLowerCase() !== 'admin') {
      const allowed = String(user['Factory Access'] || '').split(/[;,]/).map(v => v.trim().toLowerCase()).filter(Boolean);
      rows = rows.filter(r => allowed.includes(String(r.Factory || '').trim().toLowerCase()));
    }
  }
  if (key === 'quality' && fromDate && toDate) {
    const start = new Date(String(fromDate) + 'T00:00:00');
    const end = new Date(String(toDate) + 'T23:59:59.999');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) rows = rows.filter(r => {
      const value = r.Date || r['Inspection Date'];
      if (!value) return false;
      const d = value instanceof Date ? value : new Date(value);
      return !isNaN(d.getTime()) && d >= start && d <= end;
    });
  }
  return { module: key, records: rows, lastUpdated: new Date().toISOString() };
}
function appendObject_(sh, obj) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(headers.map(h => obj[h] === undefined ? '' : obj[h]));
}
/** Server-side write authorization; front-end controls are not security boundaries. */
function assertModuleWrite_(username, module) {
  const role = planningRole_(username);
  if (role === 'admin') return;
  const permitted = {
    'factory manager': ['orders','merchandising','planning','production','shipment','reconciliation','material','store','quality'],
    'planning': ['planning'], 'planner': ['planning'],
    'production': ['production'], 'qa': ['quality'], 'quality': ['quality'],
    'merchandising': ['orders','merchandising'],
    'store': ['store','material'], 'material': ['material','store'],
    'shipment': ['shipment']
  };
  if (!(permitted[role] || []).includes(module)) throw new Error('Access denied: your role cannot modify ' + module + '.');
}
/** Validate the PO and prohibit allocations greater than the matching order quantity. */
function validatePlanningAllocation_(record, existingId) {
  const factory = String(record.Factory || '').trim();
  const po = String(record.PO || '').trim();
  const line = String(record.Line || '').trim();
  const qty = num_(record['Plan Qty']);
  if (!factory || !po || !line) throw new Error('Planning requires Factory, PO and Line.');
  if (!isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) throw new Error('Plan Qty must be a positive whole number.');
  const orders = records_(getSheet_('orders')).filter(r =>
    String(r.Factory || '').trim().toLowerCase() === factory.toLowerCase() &&
    String(r['PO Number'] || r.PO || '').trim().toLowerCase() === po.toLowerCase() &&
    !/cancelled/i.test(String(r.Status || '')));
  if (!orders.length) throw new Error('No matching order exists for this PO and factory. Save the order first.');
  const ordered = orders.reduce((n,r) => n + num_(r['Order Qty']), 0);
  const planned = records_(getSheet_('planning')).filter(r =>
    String(r.Factory || '').trim().toLowerCase() === factory.toLowerCase() &&
    String(r.PO || '').trim().toLowerCase() === po.toLowerCase() &&
    String(r['Record ID'] || '') !== String(existingId || '')).reduce((n,r) => n + num_(r['Plan Qty']), 0);
  if (planned + qty > ordered) throw new Error('Over-allocation: ' + (planned + qty) + ' planned pieces exceed ' + ordered + ' ordered pieces.');
  planningValidate_(record, line, record['Start Date'], record['End Date']);
}

function saveRecord_(body) {
  const module = String(body.module || '').toLowerCase();
  if(module === 'planningapprovals') throw new Error('Use the controlled approval workflow.');
  assertModuleWrite_(body.username, module);
  const sh = getSheet_(module);
  if (!body.record || typeof body.record !== 'object' || Array.isArray(body.record)) throw new Error('A valid record object is required.');
  const record = Object.assign({}, body.record || {});
  validateERPRecord_(module, record);
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('A record object is required.');
  // Server-side derived values keep the sheet consistent even if a client omits calculations.
  if (module === 'orders') { record.SMV = Math.max(0, num_(record.SMV)); record['Order Minutes'] = Math.round(num_(record['Order Qty']) * record.SMV * 100) / 100; }
  if (module === 'quality') { const checked=num_(record['Checked Qty']); record['DHU %']=checked>0?Math.round((num_(record['Defect Qty'])/checked*100)*100)/100:0; }
  if (module === 'store') record['Balance Qty']=Math.max(0,num_(record['GRN Qty'])-num_(record['Issue Qty']));
  if (module === 'material') record['Balance Qty']=Math.max(0,num_(record['Received Qty'])-num_(record['Issued Qty']));
  if (module === 'production' && !String(record.Efficiency || '').trim()) { const target=num_(record.Target); record.Efficiency=target>0?Math.round((num_(record['Sewing Output'])/target*100)*100)/100:0; }
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const now = new Date();
  const recordIdHeader = 'Record ID';
  // Add new data fields introduced by newer ERP versions without deleting or rewriting existing columns.
  Object.keys(record).forEach(field => {
    if (!headers.some(h => key_(h) === key_(field))) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(field);
      headers.push(field);
    }
  });
  if (headers.indexOf(recordIdHeader) === -1) { sh.getRange(1, sh.getLastColumn() + 1).setValue(recordIdHeader); headers.push(recordIdHeader); }
  if (headers.indexOf('Created At') === -1) { sh.getRange(1, sh.getLastColumn() + 1).setValue('Created At'); headers.push('Created At'); }
  if (headers.indexOf('Updated At') === -1) { sh.getRange(1, sh.getLastColumn() + 1).setValue('Updated At'); headers.push('Updated At'); }
  const id = String(body.recordId || record['Record ID'] || Utilities.getUuid());
  const all = records_(sh);
  const existing = all.find(r => String(r['Record ID'] || '') === id);
  if (existing && body.expectedUpdatedAt) {
    const prior = new Date(existing['Updated At']).getTime();
    const expected = new Date(body.expectedUpdatedAt).getTime();
    if (!isFinite(prior) || !isFinite(expected) || prior !== expected)
      throw new Error('Conflict: this record changed since you opened it. Refresh before saving.');
  }
  if (module === 'orders') {
    const po = String(record['PO Number'] || existing && existing['PO Number'] || '').trim().toLowerCase();
    const factory = String(record.Factory || existing && existing.Factory || '').trim().toLowerCase();
    if (po && factory && all.some(r => r._rowNumber !== (existing && existing._rowNumber) &&
      String(r['PO Number'] || '').trim().toLowerCase() === po &&
      String(r.Factory || '').trim().toLowerCase() === factory))
      throw new Error('Duplicate order: PO Number already exists for this factory.');
  }
  if (module === 'planning') validatePlanningAllocation_(Object.assign({}, existing || {}, record), id);
  if (module === 'shipment') validateShipmentAgainstOrder_(record, all, existing, id);
  if (module === 'planning' && existing) {
    const role = planningRole_(body.username);
    if (role !== 'admin') throw new Error('Existing allocations must be modified using the controlled Planning approval workflow.');
    const protectedFields = ['Line','Start Date','End Date'];
    if (protectedFields.some(field => Object.prototype.hasOwnProperty.call(record, field) && String(record[field]) !== String(existing[field] || '')))
      throw new Error('Change line and schedule dates through Planning Move to preserve approval and audit history.');
  }
  if (module === 'production' || module === 'quality') {
    const targetFactory = String(record.Factory || '').trim();
    if (!targetFactory) throw new Error('Select a factory before saving.');
    assertFactoryPin_(body.username, module, targetFactory, body.factoryPin);
    if (existing && String(existing.Factory || '').trim() !== targetFactory) throw new Error('A saved record cannot be moved to another factory.');
    if (existing && !userCanAccessFactory_(body.username, String(existing.Factory || ''))) throw new Error('You do not have permission to modify this factory record.');
  }
  // Enforce factory ownership on all record edits, even when the client is bypassed.
  if (module !== 'production' && module !== 'quality') {
    if (record.Factory && !userCanAccessFactory_(body.username, String(record.Factory))) throw new Error('You do not have access to this factory.');
    if (existing && existing.Factory && !userCanAccessFactory_(body.username, String(existing.Factory))) throw new Error('You cannot edit a record belonging to another factory.');
    if (existing && existing.Factory && record.Factory && String(existing.Factory) !== String(record.Factory)) throw new Error('Changing a record factory is not supported.');
  }
  const output = headers.map(h => {
    if (h === 'Record ID') return id;
    if (h === 'Created At') return existing ? existing['Created At'] : now;
    if (h === 'Updated At') return now;
    const suppliedKey = Object.keys(record).find(k => key_(k) === key_(h));
    if (suppliedKey !== undefined) return safeCell_(record[suppliedKey]);
    return existing ? existing[h] : '';
  });
  if (existing) sh.getRange(existing._rowNumber, 1, 1, headers.length).setValues([output]);
  else sh.appendRow(output);
  audit_(body.username || 'system', existing ? 'UPDATE' : 'CREATE', module, id, JSON.stringify({before: existing ? redactAudit_(existing) : null, after: redactAudit_(Object.fromEntries(headers.map((h, i) => [h, output[i]]))) }).slice(0, 45000));
  return { module, recordId: id, updated: !!existing, record: Object.fromEntries(headers.map((h, i) => [h, output[i]])) };
}
function redactAudit_(record) {
  const out = {};
  Object.keys(record || {}).forEach(k => {if (!/^_|password|pin|token|secret|salt|hash/i.test(k)) out[k] = record[k] instanceof Date ? record[k].toISOString() : record[k]; });
  return out;
}
function validateERPRecord_(module, record) {
  const quantities = {
    orders:['Order Qty','SMV'], planning:['Plan Qty'],
    production:['Target','Cutting','Sewing Output','Finishing','FG Qty','Reject'],
    material:['Required Qty','Ordered Qty','Received Qty','Issued Qty'],
    store:['GRN Qty','Issue Qty'], quality:['Checked Qty','Defect Qty','Reject Qty'],
    shipment:['Shipment Plan','Actual Shipment','Carton Qty']
  };
  (quantities[module] || []).forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(record,field) || record[field] === '') return;
    const raw = String(record[field]).replace(/,/g,'').trim();
    const value = Number(raw);
    if (!raw || !isFinite(value) || value < 0) throw new Error(field + ' must be a valid non-negative number.');
  });
  if (module === 'orders' && record['Order Qty'] !== undefined && Number(record['Order Qty']) <= 0)
    throw new Error('Order Qty must be greater than zero.');
  if (module === 'quality' && record['Checked Qty'] !== undefined && num_(record['Reject Qty']) > num_(record['Checked Qty']))
    throw new Error('Rejected quantity cannot exceed checked quantity.');
  if (module === 'material' && record['Received Qty'] !== undefined && record['Issued Qty'] !== undefined && num_(record['Issued Qty']) > num_(record['Received Qty']))
    throw new Error('Issued material quantity cannot exceed received quantity.');
  if (module === 'production' && record['Finishing'] !== undefined && record['Sewing Output'] !== undefined && Number(record['Finishing']) > Number(record['Sewing Output']))
    throw new Error('Finishing output cannot exceed sewing output in this entry.');
  if (module === 'store' && record['GRN Qty'] !== undefined && record['Issue Qty'] !== undefined && Number(record['Issue Qty']) > Number(record['GRN Qty']))
    throw new Error('Issue Qty cannot exceed GRN Qty for this entry.');
}
/** Shipment quantities are cumulative per PO and factory; partial shipments remain supported. */
function validateShipmentAgainstOrder_(record, allRows, existing, recordId) {
  const po = String(record.PO || record['PO Number'] || existing && (existing.PO || existing['PO Number']) || '').trim();
  const factory = String(record.Factory || existing && existing.Factory || '').trim();
  const qty = num_(record['Actual Shipment'] !== undefined ? record['Actual Shipment'] : existing && existing['Actual Shipment']);
  if (!po || !factory || qty <= 0) return;
  const orders = records_(getSheet_('orders')).filter(r =>
    String(r.Factory || '').trim().toLowerCase() === factory.toLowerCase() &&
    String(r['PO Number'] || r.PO || '').trim().toLowerCase() === po.toLowerCase() &&
    !/cancelled/i.test(String(r.Status || '')));
  if (!orders.length) throw new Error('Shipment requires a matching Order Master PO and factory.');
  const ordered = orders.reduce((sum, r) => sum + num_(r['Order Qty']), 0);
  const alreadyShipped = allRows.filter(r => String(r['Record ID'] || '') !== String(recordId || '') &&
    String(r.Factory || '').trim().toLowerCase() === factory.toLowerCase() &&
    String(r.PO || r['PO Number'] || '').trim().toLowerCase() === po.toLowerCase())
    .reduce((sum, r) => sum + num_(r['Actual Shipment']), 0);
  if (alreadyShipped + qty > ordered) throw new Error('Shipment overage: recorded plus new shipment quantity exceeds the order quantity.');
}

function safeCell_(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' && /^[=+@\-\t\r]/.test(value)) return "'" + value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}
function deleteRecord_(body) {
  const module = String(body.module || '').toLowerCase();
  if(module === 'planningapprovals') throw new Error('Approval requests cannot be deleted.');
  if(module === 'planning' && planningRole_(body.username) !== 'admin') throw new Error('Only an administrator may delete a planning allocation.');
  assertModuleWrite_(body.username, module);
  const sh = getSheet_(module);
  const id = String(body.recordId || '');
  if (!id) throw new Error('recordId is required.');
  const all = records_(sh);
  const row = all.find(r => String(r['Record ID'] || '') === id);
  if (!row) throw new Error('Record not found.');
  if (row.Factory && !userCanAccessFactory_(body.username, String(row.Factory))) throw new Error('You cannot delete a record belonging to another factory.');
  if (module === 'production' || module === 'quality') assertFactoryPin_(body.username, module, String(row.Factory || ''), body.factoryPin);
  if (body.expectedUpdatedAt && new Date(body.expectedUpdatedAt).getTime() !== new Date(row['Updated At']).getTime()) throw new Error('Conflict: this record has changed. Refresh before deleting.');
  sh.deleteRow(row._rowNumber);
  audit_(body.username || 'system', 'DELETE', module, id, JSON.stringify({before:redactAudit_(row)}).slice(0,45000));
  return { module, recordId: id, deleted: true };
}
function audit_(username, action, module, id, details) {
  try { const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.audit.name); if (sh) appendObject_(sh, { Timestamp: new Date(), Username: username, Action: action, Module: module, 'Record ID': id, Details: details }); } catch (_) {}
}

// Factory-specific protection for Production and Quality.
// Run setERPUserFactoryAccess(username, factory) to assign a non-admin user.
// Run setFactoryModulePin(factory, module, pin) once for each factory/module.
function assignERPFactoryFromPrompt() {
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.users.name);
  if (!sh) {
    ui.alert('ERP_Users is missing. Run setupBenchmarkERP() first, then create users.');
    return;
  }
  const accounts = records_(sh);
  if (!accounts.length) {
    ui.alert('No ERP users exist. Run setupBenchmarkERP() to create the initial administrator, then create additional users using createERPUserFromPrompt().');
    return;
  }
  const names = accounts.map(r => String(r.Username || '').trim()).filter(Boolean);
  const userPrompt = ui.prompt('Assign factory access',
    'Enter an EXISTING ERP username (not a display name).\nAvailable usernames: ' + names.join(', '), ui.ButtonSet.OK_CANCEL);
  if (userPrompt.getSelectedButton() !== ui.Button.OK) return;
  const username = String(userPrompt.getResponseText() || '').trim();
  if (!username) { ui.alert('Username cannot be empty.'); return; }
  const account = accounts.find(r => String(r.Username || '').trim().toLowerCase() === username.toLowerCase());
  if (!account) {
    ui.alert('ERP user not found: ' + username + '.\n\nThis is not a Code.gs execution failure: the account does not exist in ERP_Users.\nUse createERPUserFromPrompt() to create the account, then run assignERPFactoryFromPrompt() again.\nAvailable usernames: ' + names.join(', '));
    return;
  }
  if (String(account.Role || '').trim().toLowerCase() === 'admin') {
    ui.alert('Admin is global and does not need a factory assignment. Leave Factory Access blank in ERP_Users.');
    return;
  }
  const factoryPrompt = ui.prompt('Assign factory access',
    'Choose an exact factory: Benchmark Apparels, Benchmark Exports, or Fabtex. You may enter multiple factories separated by commas. Leave blank to remove access.', ui.ButtonSet.OK_CANCEL);
  if (factoryPrompt.getSelectedButton() !== ui.Button.OK) return;
  try {
    const factory = setERPUserFactoryAccess(String(account.Username), factoryPrompt.getResponseText());
    ui.alert('Factory access updated for ' + account.Username + ': ' + (factory || '(unassigned)') + '. User should sign out and sign in again.');
  } catch (err) { ui.alert('Factory assignment failed: ' + message_(err)); }
}

/** Show usernames, roles and factory assignments without displaying password hashes. */
function showERPUsers() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.users.name);
  if (!sh) { Logger.log('ERP_Users is missing. Run setupBenchmarkERP() first.'); return []; }
  const users = records_(sh).map(r => ({
    username: String(r.Username || ''), name: String(r['Full Name'] || ''),
    role: String(r.Role || ''), active: active_(r.Active),
    factoryAccess: String(r['Factory Access'] || '')
  }));
  users.forEach(u => Logger.log(JSON.stringify(u)));
  return users;
}

function configureFactoryPinFromPrompt() {
  const ui = SpreadsheetApp.getUi();
  const factoryPrompt = ui.prompt('Configure factory PIN', 'Enter exact factory name: Benchmark Apparels, Benchmark Exports, or Fabtex', ui.ButtonSet.OK_CANCEL);
  if (factoryPrompt.getSelectedButton() !== ui.Button.OK) return;
  const modulePrompt = ui.prompt('Configure factory PIN', 'Enter module: production or quality', ui.ButtonSet.OK_CANCEL);
  if (modulePrompt.getSelectedButton() !== ui.Button.OK) return;
  const pinPrompt = ui.prompt('Configure factory PIN', 'Enter a new 6–12 digit PIN. Do not reuse another factory/module PIN.', ui.ButtonSet.OK_CANCEL);
  if (pinPrompt.getSelectedButton() !== ui.Button.OK) return;
  setFactoryModulePin(factoryPrompt.getResponseText(), modulePrompt.getResponseText(), pinPrompt.getResponseText());
  ui.alert('Factory PIN configured. The PIN is stored as a salted hash, not plain text.');
}

function setERPUserFactoryAccess(username, factory) {
  if (arguments.length < 1 || !String(username || '').trim()) throw new Error('Do not run setERPUserFactoryAccess directly from the Run menu. Run assignERPFactoryFromPrompt instead. Admin needs no factory assignment.');
  const allowed = ['Benchmark Apparels','Benchmark Exports','Fabtex'];
  const factories = String(factory || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
  const invalid = factories.filter(f => !allowed.includes(f));
  if (invalid.length) throw new Error('Unknown factory: ' + invalid.join(', ') + '. Use: ' + allowed.join(', '));
  const chosen = Array.from(new Set(factories)).join(', ');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.users.name);
  if (!sh) throw new Error('ERP_Users sheet missing. Run setupBenchmarkERP() first.');
  const user = records_(sh).find(r => String(r.Username || '').trim().toLowerCase() === String(username || '').trim().toLowerCase());
  if (!user) throw new Error('ERP user not found: ' + username + '. Run showERPUsers() for valid usernames; create the account with createERPUserFromPrompt() if missing.');
  if (String(user.Role || '').trim().toLowerCase() === 'admin' && chosen) throw new Error('Admin is a global role. Do not assign a factory to Admin; use clearAdminFactoryAccess() to clear any old assignment.');
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const col = headers.indexOf('Factory Access') + 1;
  if (!col) throw new Error('Factory Access column missing. Run setupBenchmarkERP() first.');
  sh.getRange(user._rowNumber,col).setValue(chosen);
  const updatedCol = headers.indexOf('Updated At') + 1;
  if (updatedCol) sh.getRange(user._rowNumber,updatedCol).setValue(new Date());
  audit_(String(user.Username),'SET_FACTORY_ACCESS','users',String(user.Username),'Factory Access set to ' + (chosen || '(unassigned)'));
  Logger.log('Factory access updated for ' + user.Username + ': ' + (chosen || '(unassigned)'));
  return chosen;
}

function setFactoryModulePin(factory, module, pin) {
  const allowedFactories = ['Benchmark Apparels','Benchmark Exports','Fabtex'];
  const chosenFactory = String(factory || '').trim();
  const chosenModule = String(module || '').trim().toLowerCase();
  const chosenPin = String(pin || '');
  if (allowedFactories.indexOf(chosenFactory) === -1) throw new Error('Unknown factory. Use: ' + allowedFactories.join(', '));
  if (['production','quality'].indexOf(chosenModule) === -1) throw new Error('Module must be production or quality.');
  if (!/^\d{6,12}$/.test(chosenPin)) throw new Error('Use a 6–12 digit numeric PIN.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet_(ss, ERP_SHEETS.factorySecurity.name, ERP_SHEETS.factorySecurity.headers);
  const all = records_(sh);
  const existing = all.find(r => String(r.Factory) === chosenFactory && String(r.Module).toLowerCase() === chosenModule);
  const salt = Utilities.getUuid();
  const values = { Factory:chosenFactory, Module:chosenModule, 'PIN Salt':salt, 'PIN Hash':hashPassword_(chosenPin,salt), Active:true, 'Updated At':new Date() };
  if (existing) {
    const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
    sh.getRange(existing._rowNumber,1,1,headers.length).setValues([headers.map(h => values[h] === undefined ? existing[h] : values[h])]);
  } else appendObject_(sh,values);
  audit_('admin','SET_FACTORY_PIN',chosenModule,chosenFactory,'Factory PIN hash updated');
  Logger.log('PIN configured for ' + chosenFactory + ' / ' + chosenModule + '. The PIN itself is not logged.');
}

function findERPUser_(username) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.users.name);
  if (!sh) throw new Error('ERP_Users sheet missing. Run setupBenchmarkERP() first.');
  const user = records_(sh).find(r => String(r.Username || '').trim().toLowerCase() === String(username || '').trim().toLowerCase());
  if (!user || !active_(user.Active)) throw new Error('Active ERP user not found. Sign in again or ask the administrator.');
  return user;
}

function userCanAccessFactory_(username, factory) {
  if (!username || !factory) return false;
  try {
    const user = findERPUser_(username);
    if (String(user.Role || '').trim().toLowerCase() === 'admin') return true;
    const access = String(user['Factory Access'] || '').trim();
    return access.split(/[;,]/).map(v => v.trim().toLowerCase()).includes(String(factory).trim().toLowerCase());
  } catch (_) { return false; }
}

function assertFactoryPin_(username, module, factory, pin) {
  const chosenModule = String(module || '').toLowerCase();
  const chosenFactory = String(factory || '').trim();
  if (!userCanAccessFactory_(username, chosenFactory)) throw new Error('Access denied: your ERP account is not assigned to ' + chosenFactory + '. Ask the administrator to assign your factory.');
  if (!/^\d{6,12}$/.test(String(pin || ''))) throw new Error('Enter your 6–12 digit factory PIN.');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.factorySecurity.name);
  if (!sh) throw new Error('Factory security is not configured. Ask the administrator to set the factory PINs.');
  const security = records_(sh).find(r => String(r.Factory || '').trim() === chosenFactory && String(r.Module || '').trim().toLowerCase() === chosenModule && active_(r.Active));
  if (!security) throw new Error('No PIN is configured for ' + chosenFactory + ' / ' + chosenModule + '. Ask the administrator to configure it.');
  if (hashPassword_(String(pin),String(security['PIN Salt'] || '')) !== String(security['PIN Hash'] || '')) throw new Error('Incorrect factory PIN.');
}

function verifyFactoryPin_(body) {
  const module = String(body.module || '').toLowerCase();
  const factory = String(body.factory || '').trim();
  assertFactoryPin_(body.username,module,factory,body.pin);
  audit_(body.username,'VERIFY_FACTORY_PIN',module,factory,'Factory PIN verified');
  return { verified:true, module, factory };
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + '|' + String(password), Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
/** Basic username-based login throttling. Apps Script does not expose the caller IP reliably. */
function loginWithThrottle_(body) {
  const username = String(body && body.username || '').trim().toLowerCase();
  if (!username) return login_(body);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, username, Utilities.Charset.UTF_8);
  const cacheKey = 'ERP_LOGIN_FAIL_' + Utilities.base64EncodeWebSafe(digest).replace(/[^A-Za-z0-9]/g, '').slice(0, 28);
  const cache = CacheService.getScriptCache();
  const attempts = Number(cache.get(cacheKey) || 0);
  if (attempts >= 8) throw new Error('Too many failed login attempts for this username. Wait 15 minutes and try again.');
  try {
    const result = login_(body);
    cache.remove(cacheKey);
    return result;
  } catch (err) {
    const message = message_(err);
    if (/invalid username or password|account is inactive/i.test(message)) {
      cache.put(cacheKey, String(attempts + 1), 900);
    }
    throw err;
  }
}

function login_(body) {
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!username || !password) throw new Error('Enter both username and password.');
  const cache = CacheService.getScriptCache();
  const throttleKey = 'erp-login-' + hashPassword_(username, 'throttle').slice(0, 32);
  const attempts = Number(cache.get(throttleKey) || 0);
  if (attempts >= 7) throw new Error('Too many failed login attempts. Please retry after 15 minutes.');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.users.name);
  const user = records_(sh).find(r => String(r.Username || '').trim().toLowerCase() === username);
  if (!user || !active_(user.Active) || hashPassword_(password, user['Password Salt']) !== String(user['Password Hash'] || '')) {
    cache.put(throttleKey, String(attempts + 1), 900);
    throw new Error('Invalid username or password, or this account is inactive.');
  }
  cache.remove(throttleKey);
  audit_(user.Username, 'LOGIN', 'users', username, 'Successful login');
  return { user: publicUser_(user) };
}
function changePassword_(body) {
  const username = String(body.username || '').trim().toLowerCase();
  const oldPassword = String(body.oldPassword || '');
  const newPassword = String(body.newPassword || '');
  if (newPassword.length < 10) throw new Error('New password must contain at least 10 characters.');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.users.name);
  const user = records_(sh).find(r => String(r.Username || '').trim().toLowerCase() === username);
  if (!user || !active_(user.Active) || hashPassword_(oldPassword, user['Password Salt']) !== String(user['Password Hash'] || '')) throw new Error('Current password is incorrect.');
  const salt = Utilities.getUuid();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const row = headers.map(h => h === 'Password Salt' ? salt : h === 'Password Hash' ? hashPassword_(newPassword, salt) : h === 'Must Change Password' ? false : h === 'Updated At' ? new Date() : user[h]);
  sh.getRange(user._rowNumber, 1, 1, headers.length).setValues([row]);
  audit_(user.Username, 'CHANGE_PASSWORD', 'users', username, 'Password changed');
  const refreshed = Object.assign({}, user, { 'Must Change Password': false });
  return { user: publicUser_(refreshed) };
}
function publicUser_(user) {
  return { username: String(user.Username), name: String(user['Full Name'] || user.Username), role: String(user.Role || 'User'), factoryAccess: String(user['Factory Access'] || ''), mustChangePassword: active_(user['Must Change Password']) };
}

/** Run manually from Apps Script editor to provision a user. Example: createERPUser('qa01','QA Inspector','QA','Temporary@12345') */
function createERPUserFromPrompt() {
  const ui = SpreadsheetApp.getUi();
  const username = ui.prompt('Create ERP user', 'Username:', ui.ButtonSet.OK_CANCEL);
  if (username.getSelectedButton() !== ui.Button.OK) return;
  const fullName = ui.prompt('Create ERP user', 'Full name:', ui.ButtonSet.OK_CANCEL);
  if (fullName.getSelectedButton() !== ui.Button.OK) return;
  const role = ui.prompt('Create ERP user', 'Role (Admin, Factory Manager, Production, QA, Merchandising, Store):', ui.ButtonSet.OK_CANCEL);
  if (role.getSelectedButton() !== ui.Button.OK) return;
  const password = ui.prompt('Create ERP user', 'Temporary password (minimum 10 characters):', ui.ButtonSet.OK_CANCEL);
  if (password.getSelectedButton() !== ui.Button.OK) return;
  createERPUser(username.getResponseText(), fullName.getResponseText(), role.getResponseText(), password.getResponseText());
  ui.alert('User created. Share the temporary password securely; the user must change it at first login.');
}

function createERPUser(username, fullName, role, temporaryPassword) {
  if (!username || !fullName || !role || !temporaryPassword || String(temporaryPassword).length < 10) throw new Error('Provide username, full name, role, and a temporary password of at least 10 characters.');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.users.name);
  const exists = records_(sh).some(r => String(r.Username).toLowerCase() === String(username).toLowerCase());
  if (exists) throw new Error('That username already exists.');
  const salt = Utilities.getUuid();
  appendObject_(sh, { Username:String(username).trim(), 'Full Name':String(fullName).trim(), Role:String(role).trim(), 'Password Salt':salt, 'Password Hash':hashPassword_(temporaryPassword,salt), Active:true, 'Must Change Password':true, 'Factory Access':'', 'Created At':new Date(), 'Updated At':new Date() });
  Logger.log('User created: ' + username + '. They must change their temporary password at first login.');
}

function setupFactoryCapacitySheet_(ss) {
  const name = 'Factory_Capacity';
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const headers = ['Factory','Sewing Lines','Operators Per Line','Working Minutes Per Day','Working Days Per Month','Capacity Minutes','Notes'];
  ensureSheet_(ss, name, headers);
  if (sh.getLastRow() < 2) {
    sh.getRange(2,1,3,headers.length).setValues([
      ['Benchmark Apparels',10,25,480,26,'=B2*C2*D2*E2','Initial values from user notes; verify before operational use'],
      ['Benchmark Exports',7,25,480,26,'=B3*C3*D3*E3','Initial values from user notes; verify before operational use'],
      ['Fabtex',6,25,480,26,'=B4*C4*D4*E4','Initial values from user notes; verify before operational use']
    ]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
    sh.getRange(2,2,sh.getLastRow()-1,4).setNumberFormat('0.##');
    sh.getRange(2,6,sh.getLastRow()-1,1).setNumberFormat('#,##0');
  }
}

function readFactoryCapacity_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Factory_Capacity');
  const defaults = [
    {Factory:'Benchmark Apparels','Sewing Lines':10,'Operators Per Line':25,'Working Minutes Per Day':480,'Working Days Per Month':26},
    {Factory:'Benchmark Exports','Sewing Lines':7,'Operators Per Line':25,'Working Minutes Per Day':480,'Working Days Per Month':26},
    {Factory:'Fabtex','Sewing Lines':6,'Operators Per Line':25,'Working Minutes Per Day':480,'Working Days Per Month':26}
  ];
  const rows = sh ? records_(sh) : [];
  const source = rows.length ? rows : defaults;
  return source.map(r => {
    const lines=num_(r['Sewing Lines']), operators=num_(r['Operators Per Line']), minutes=num_(r['Working Minutes Per Day']) || 480, days=num_(r['Working Days Per Month']) || 26;
    return {name:String(r.Factory || '').trim(),lines,operatorsPerLine:operators,workingMinutesPerDay:minutes,workingDays:days,capacityMinutes:lines*operators*minutes*days};
  }).filter(r => r.name);
}

function buildDashboard_(fromDate, toDate, username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let orders = records_(ss.getSheetByName(ERP_SHEETS.orders.name));
  let production = records_(ss.getSheetByName(ERP_SHEETS.production.name));
  let shipments = records_(ss.getSheetByName(ERP_SHEETS.shipment.name));
  let allowedFactories = null;
  if (username) {
    const user = findERPUser_(username);
    if (String(user.Role || '').trim().toLowerCase() !== 'admin') {
      allowedFactories = String(user['Factory Access'] || '').split(/[;,]/).map(v => v.trim().toLowerCase()).filter(Boolean);
      const permitted = r => allowedFactories.includes(String(r.Factory || '').trim().toLowerCase());
      orders = orders.filter(permitted); production = production.filter(permitted); shipments = shipments.filter(permitted);
    }
  }
  const from = String(fromDate || '').trim();
  const to = String(toDate || '').trim();
  if (from && to) {
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T23:59:59.999');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const inRange = value => {
        if (!value) return false;
        const d = value instanceof Date ? value : new Date(value);
        return !isNaN(d.getTime()) && d >= start && d <= end;
      };
      orders = orders.filter(r => inRange(r.Date || r['Order Date'] || r['Shipment Date']));
      production = production.filter(r => inRange(r.Date || r['Production Date']));
      shipments = shipments.filter(r => inRange(r.Date || r.ETD || r['Shipment Date']));
    }
  }
  const runningOrders = orders.reduce((s, r) => s + (/shipped|closed|cancelled/i.test(String(r.Status)) ? 0 : num_(r['Order Qty'])), 0);
  const monthlyShipment = shipments.reduce((s, r) => s + num_(r['Actual Shipment']), 0);
  const eff = production.map(r => num_(r.Efficiency)).filter(n => n > 0);
  const productionEfficiency = eff.length ? Math.round(eff.reduce((a, b) => a + b, 0) / eff.length) : 0;
  const criticalAlerts = production.filter(r => /delayed|critical|risk/i.test(String(r.Status))).length;
  const lines = production.map(r => { const target=num_(r.Target), output=num_(r['Sewing Output']); return { line: String(r.Line || ''), factory: String(r.Factory || ''), po: String(r.PO || r['PO Number'] || ''), target, output, efficiency: num_(r.Efficiency) || (target>0?Math.round(output/target*10000)/100:0), reject: num_(r.Reject), status: String(r.Status || 'Pending') }; });
  let capacityRows = readFactoryCapacity_();
  if (allowedFactories) capacityRows = capacityRows.filter(r => allowedFactories.includes(String(r.name || '').trim().toLowerCase()));
  const factoryNames = Array.from(new Set(capacityRows.map(r => r.name).concat(orders.concat(production, shipments).map(r => String(r.Factory || '').trim()).filter(Boolean))));
  const factories = factoryNames.map(name => {
    const o = orders.filter(r => String(r.Factory || '').trim() === name && !/shipped|closed|cancelled/i.test(String(r.Status || ''))), p = production.filter(r => String(r.Factory || '').trim() === name), s = shipments.filter(r => String(r.Factory || '').trim() === name);
    const cap = capacityRows.find(r => r.name === name) || {lines:new Set(p.map(r => String(r.Line || '')).filter(Boolean)).size,operatorsPerLine:0,workingMinutesPerDay:480,workingDays:26,capacityMinutes:0};
    const orderQty = o.reduce((a, r) => a + num_(r['Order Qty']), 0);
    const orderMinutes = o.reduce((a, r) => a + num_(r['Order Qty']) * num_(r.SMV), 0);
    return { name, lines: cap.lines, operatorsPerLine: cap.operatorsPerLine, workingMinutesPerDay: cap.workingMinutesPerDay, workingDays: cap.workingDays, capacityMinutes: cap.capacityMinutes, orders: orderQty, orderMinutes: Math.round(orderMinutes*100)/100, production: p.reduce((a, r) => a + num_(r['Sewing Output']), 0), shipment: s.reduce((a, r) => a + num_(r['Actual Shipment']), 0), orderPercent: cap.capacityMinutes>0?Math.round(orderMinutes/cap.capacityMinutes*100):0, productionPercent: p.length ? Math.round(p.reduce((a, r) => { const target=num_(r.Target), output=num_(r['Sewing Output']); return a + (num_(r.Efficiency) || (target>0?output/target*100:0)); }, 0) / p.length) : 0, shipmentPercent: orderQty>0?Math.round(s.reduce((a, r) => a + num_(r['Actual Shipment']), 0)/orderQty*100):0 };
  });
  const months = Array.from({ length: 12 }, (_, i) => ({ month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i], orders: 0, shipments: 0 }));
  const monthIndex = v => { const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? -1 : d.getMonth(); };
  orders.forEach(r => { const i = monthIndex(r.Date || r['Order Date'] || r['Shipment Date']); if (i >= 0) months[i].orders += num_(r['Order Qty']); });
  shipments.forEach(r => { const i = monthIndex(r.ETD || r.Date); if (i >= 0) months[i].shipments += num_(r['Actual Shipment']); });
  // PO/style/factory progress: master quantity from Orders, cumulative stage quantities from Production.
  // Each stage is measured against ORDER quantity, not the preceding stage.
  const progressMap = {};
  const clean = v => String(v == null ? '' : v).trim();
  const progressKey = (factory, po, style) => [clean(factory).toLowerCase(),clean(po).toLowerCase(),clean(style).toLowerCase()].join('||');
  orders.forEach(order => {
    const factory=clean(order.Factory), po=clean(order['PO Number'] || order.PO), style=clean(order.Style);
    if (!po || !factory) return;
    const key=progressKey(factory,po,style);
    if (!progressMap[key]) progressMap[key]={factory,po,style,buyer:clean(order.Buyer),orderQty:0,cutting:0,sewing:0,finishing:0,hasOrder:true,productionEntries:0};
    progressMap[key].orderQty += num_(order['Order Qty'] || order.Qty);
  });
  production.forEach(row => {
    const factory=clean(row.Factory),po=clean(row.PO || row['PO Number']),style=clean(row.Style);
    if (!po || !factory) return;
    const key=progressKey(factory,po,style);
    if (!progressMap[key]) progressMap[key]={factory,po,style,buyer:'',orderQty:0,cutting:0,sewing:0,finishing:0,hasOrder:false,productionEntries:0};
    progressMap[key].cutting+=num_(row.Cutting || row['Cut Qty']);
    progressMap[key].sewing+=num_(row['Sewing Output'] || row['Sew Qty']);
    progressMap[key].finishing+=num_(row.Finishing || row['Finishing Qty']);
    progressMap[key].productionEntries++;
  });
  const poStyleProgress=Object.keys(progressMap).map(key => {
    const row=progressMap[key];
    const percent=value => row.orderQty>0 ? Math.round(value/row.orderQty*10000)/100 : null;
    return {...row,cuttingPct:percent(row.cutting),sewingPct:percent(row.sewing),finishingPct:percent(row.finishing),
      cuttingBalance:Math.max(0,row.orderQty-row.cutting),sewingBalance:Math.max(0,row.orderQty-row.sewing),finishingBalance:Math.max(0,row.orderQty-row.finishing),
      warning:!row.hasOrder?'Missing order master': row.cutting>row.orderQty || row.sewing>row.cutting || row.finishing>row.sewing?'Check stage quantities':'',
    };
  }).sort((a,b)=>a.factory.localeCompare(b.factory)||a.po.localeCompare(b.po)||a.style.localeCompare(b.style));
  return { lastUpdated: new Date().toISOString(), kpis: { runningOrders, monthlyShipment, productionEfficiency, criticalAlerts }, factories, months, lines, poStyleProgress };
}
function buildReconciliation_(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orders = records_(ss.getSheetByName(ERP_SHEETS.orders.name));
  const prod = records_(ss.getSheetByName(ERP_SHEETS.production.name));
  const ships = records_(ss.getSheetByName(ERP_SHEETS.shipment.name));
  const materials = records_(ss.getSheetByName(ERP_SHEETS.material.name));
  const store = records_(ss.getSheetByName(ERP_SHEETS.store.name));
  let allowedFactories = null;
  if (username) {
    const user = findERPUser_(username);
    if (String(user.Role || '').trim().toLowerCase() !== 'admin') {
      allowedFactories = String(user['Factory Access'] || '').split(/[;,]/).map(v => v.trim().toLowerCase()).filter(Boolean);
      const permitted = r => allowedFactories.includes(String(r.Factory || '').trim().toLowerCase());
      orders.splice(0, orders.length, ...orders.filter(permitted));
      prod.splice(0, prod.length, ...prod.filter(permitted));
      ships.splice(0, ships.length, ...ships.filter(permitted));
      materials.splice(0, materials.length, ...materials.filter(permitted));
      store.splice(0, store.length, ...store.filter(permitted));
    }
  }
  // Derive reconciliation from the operational source tabs so new order/production/shipment
  // entries are reflected immediately rather than relying on stale copied totals.
  let rows = orders.map(o => {
    const po = String(o['PO Number'] || o.PO || '');
    const p = prod.filter(r => String(r.PO || r['PO Number'] || '') === po);
    const s = ships.filter(r => String(r.PO || r['PO Number'] || '') === po);
    const m = materials.filter(r => String(r.PO || r['PO Number'] || '') === po);
    const st = store.filter(r => String(r.PO || r['PO Number'] || '') === po);
    const orderQty = num_(o['Order Qty']);
    const materialIssued = m.reduce((a,r)=>a+num_(r['Issued Qty']),0) + st.reduce((a,r)=>a+num_(r['Issue Qty']),0);
    const cutQty = p.reduce((a,r)=>a+num_(r.Cutting),0);
    const sewQty = p.reduce((a,r)=>a+num_(r['Sewing Output']),0);
    const finishQty = p.reduce((a,r)=>a+num_(r.Finishing),0);
    const fgQty = p.reduce((a,r)=>a+num_(r['FG Qty']),0);
    const shipmentQty = s.reduce((a,r)=>a+num_(r['Actual Shipment']),0);
    const balance = orderQty-shipmentQty;
    const variance = Math.max(0,cutQty-fgQty);
    return { buyer:String(o.Buyer||''), style:String(o.Style||''), po, factory:String(o.Factory||''), orderQty, materialIssued, cutQty, sewQty, finishQty, fgQty, shipmentQty, balance, variance, status:balance<=0?'Complete':variance>1000?'Critical':'Attention' };
  });
  if (!rows.length) {
    rows = records_(ss.getSheetByName(ERP_SHEETS.reconciliation.name)).map(r => ({ buyer:String(r.Buyer||''), style:String(r.Style||''), po:String(r.PO||r['PO Number']||''), factory:String(r.Factory||''), orderQty:num_(r['Order Qty']), materialIssued:num_(r['Material Issued']), cutQty:num_(r['Cut Qty']), sewQty:num_(r['Sew Qty']), finishQty:num_(r['Finish Qty']), fgQty:num_(r['FG Qty']), shipmentQty:num_(r['Shipment Qty']), balance:num_(r.Balance), variance:num_(r.Variance), status:String(r.Status||'Attention') }));
  }
  if (allowedFactories) rows = rows.filter(r => allowedFactories.includes(String(r.factory || '').trim().toLowerCase()));
  return { lastUpdated:new Date().toISOString(), reconciliation:rows };
}

// v10.8: planning workflow mutations use one lock to avoid simultaneous edits.
function planningLocked_(fn) { const lock=LockService.getScriptLock(); if(!lock.tryLock(25000))throw new Error('Planning is busy; retry.');try{return fn();}finally{lock.releaseLock();} }
function planningRole_(username) {const user=findERPUser_(username);if(!user||!active_(user.Active))throw new Error('Account not active');return String(user.Role||'').trim().toLowerCase();}
function planningFind_(id){const sh=getSheet_('planning');const row=records_(sh).find(r=>String(r['Record ID'])===String(id));if(!row)throw new Error('Allocation not found. Refresh the page.');return {sh,row};}
function planningUnique_(factory,po,exceptId) {const records=records_(getSheet_('planning'));return records.filter(r=>String(r.Factory)===factory&&String(r.PO)===po&&String(r['Record ID'])!==String(exceptId)).reduce((n,r)=>n+num_(r['Plan Qty']),0);}
function planningValidate_(row,line,start,end){if(!line||!String(line).trim())throw new Error('Target line is required');if(start&&end&&String(end)<String(start))throw new Error('End date cannot precede start');if(String(row.Status||'').toLowerCase()==='completed')throw new Error('Completed allocation cannot be moved');}
function planningApply_(username,id,line,start,end,expectedUpdated) {
 const f=planningFind_(id),r=f.row;
 if(!userCanAccessFactory_(username,String(r.Factory)))throw new Error('Factory access denied');
 if(expectedUpdated&&new Date(r['Updated At']).getTime()!==new Date(expectedUpdated).getTime())throw new Error('Allocation changed since you last loaded it. Refresh and retry.');
 planningValidate_(r,line,start,end);
 const headers=f.sh.getRange(1,1,1,f.sh.getLastColumn()).getValues()[0].map(String);
 const replacements={Line:String(line),'Start Date':start||r['Start Date'],'End Date':end||r['End Date'],'Updated At':new Date()};
 const values=headers.map(h=>Object.prototype.hasOwnProperty.call(replacements,h)?replacements[h]:r[h]);
 f.sh.getRange(r._rowNumber,1,1,headers.length).setValues([values]);
 audit_(username,'MOVE','planning',id,'Line '+r.Line+' -> '+line);
 return {recordId:id,line};
}
function planningMove_(b) {return planningLocked_(()=>{const role=planningRole_(b.username);const row=planningFind_(b.recordId).row;if(role!=='admin'&&String(b.line)!==String(row.Line))throw new Error('Line changes require approval; submit a request.');return planningApply_(b.username,b.recordId,b.line,b.start,b.end,b.expectedUpdated);});}
function planningRequest_(b) {return planningLocked_(()=>{planningRole_(b.username);const row=planningFind_(b.recordId).row;if(!userCanAccessFactory_(b.username,String(row.Factory)))throw new Error('Factory access denied');planningValidate_(row,b.line,b.start,b.end);const id=Utilities.getUuid();appendObject_(getSheet_('planningapprovals'),{'Request ID':id,'Requested At':new Date(),'Requested By':b.username,Factory:row.Factory,PO:row.PO,'Allocation ID':b.recordId,'Proposed Line':b.line,'Proposed Start':b.start||row['Start Date'],'Proposed End':b.end||row['End Date'],Reason:String(b.reason||'').slice(0,500),Status:'Pending'});audit_(b.username,'REQUEST','planningapprovals',id,'Requested allocation change');return {requestId:id,status:'Pending'};});}
function planningReview_(b) {return planningLocked_(()=>{if(planningRole_(b.username)!=='admin')throw new Error('Only ERP Admin can approve cross-line moves');const sh=getSheet_('planningapprovals');const row=records_(sh).find(r=>String(r['Request ID'])===String(b.requestId));if(!row||String(row.Status)!=='Pending')throw new Error('Request not found or already reviewed');const approve=String(b.decision).toLowerCase()==='approved';if(approve)planningApply_(b.username,row['Allocation ID'],row['Proposed Line'],row['Proposed Start'],row['Proposed End'],'');const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);const updates={Status:approve?'Approved':'Rejected','Reviewed By':b.username,'Reviewed At':new Date(),'Decision Note':String(b.note||'').slice(0,500)};sh.getRange(row._rowNumber,1,1,headers.length).setValues([headers.map(h=>Object.prototype.hasOwnProperty.call(updates,h)?updates[h]:row[h])]);audit_(b.username,approve?'APPROVE':'REJECT','planningapprovals',b.requestId,String(b.note||''));return {requestId:b.requestId,status:approve?'Approved':'Rejected'};});}


/** Safe direct-run setup: configure sheets and normalize the Admin's factory access. */
function setupBenchmarkERPAndAdmin() {
  setupBenchmarkERP();
  clearAdminFactoryAccess();
  Logger.log('ERP setup complete. Admin is global and has no factory assignment.');
}

/** Direct-run utility; does not change Admin role or credentials. */
function clearAdminFactoryAccess() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ERP_SHEETS.users.name);
  if (!sh) throw new Error('ERP_Users missing. Run setupBenchmarkERP() first.');
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const factoryCol = headers.indexOf('Factory Access') + 1;
  if (!factoryCol) throw new Error('Factory Access column missing. Run setupBenchmarkERP() first.');
  const admins = records_(sh).filter(r => String(r.Role || '').trim().toLowerCase() === 'admin');
  if (!admins.length) throw new Error('No Admin account exists in ERP_Users. Finish initial setup first.');
  admins.forEach(r => {
    if (String(r['Factory Access'] || '').trim()) {
      sh.getRange(r._rowNumber, factoryCol).clearContent();
      audit_(String(r.Username), 'CLEAR_ADMIN_FACTORY', 'users', String(r.Username), 'Global Admin factory assignment cleared');
    }
  });
  Logger.log('Checked ' + admins.length + ' Admin account(s); factory access remains blank for global Admin users.');
  return { adminAccounts: admins.length, factoryAssignment: '' };
}
