
'use server';

import type { Contractor, Company, Deduction } from '@/stores/deductions-store';
import { google } from 'googleapis';
import { randomUUID } from 'crypto';
import { isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';


// This is a server-side store for mock data when Google Sheets is not configured.
// It's a simple in-memory store that will be reset on server restart.
const mockSubmissions: Submission[] = [];


export interface Submission {
  reportId: string;
  timestamp: string;
  userEmail: string;
  status: string; // This field might not be available from the sheet directly
  company: Company | null;
  contractors: Contractor[];
  grandTotal: number;
}

interface SubmitDeductionsPayload {
  company: Company;
  contractors: Contractor[];
  userEmail:string;
}

// ================= GOOGLE SHEETS SETUP =================
const USERS_SHEET_NAME = 'Users';
const CONTRACTORS_SHEET_NAME = 'Contractors';

const SUBMISSION_HEADERS = [
    "التاريخ", "الوقت", "المهندس /المشرف", "الشركة", "اسم المقاول", "اسم العقد", 
    "بند العمل", "بيان العمل", "مايوازي بالمتر", "عدد اليوميات", "الفئه",
    "الاجمالي", "بالخصم علي", "ملحوظه", "الحالة",
    "تاريخ التأكيد", "وقت التأكيد", "المؤكد بواسطة" // New approval columns
];

const USER_HEADERS = ["Email", "Password", "Role"]; // Added Role column
const DATA_HEADERS = ["Contract Name", "Work Item"];
const CONTRACTOR_LIST_HEADERS = ["Contractor Name"];


async function getSheetsApi() {
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !sheetId) {
    const message = `Google Sheets API not configured. Check GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY environment variables.`;
    console.warn(`WARN: ${message}`);
    return null;
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    return {
        sheets: google.sheets('v4'),
        auth: auth,
        spreadsheetId: sheetId
    };
  } catch (error) {
    console.error("ERROR: Failed to initialize Google Sheets API. Check your GOOGLE_SERVICE_ACCOUNT_KEY.", error);
    return null;
  }
}

async function ensureSheetAndHeaders(sheets: any, auth: any, spreadsheetId: string, sheetName: string, headers: string[]) {
    try {
        const spreadsheetInfo = await sheets.spreadsheets.get({ auth, spreadsheetId });
        const sheet = spreadsheetInfo.data.sheets.find((s: any) => s.properties.title === sheetName);

        if (!sheet) {
            console.log(`Sheet "${sheetName}" not found. Creating it with headers...`);
            await sheets.spreadsheets.batchUpdate({
                auth,
                spreadsheetId,
                requestBody: {
                    requests: [{ addSheet: { properties: { title: sheetName } } }],
                },
            });
            await sheets.spreadsheets.values.update({
                auth,
                spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [headers] },
            });
            console.log(`Sheet "${sheetName}" created and headers written.`);
            return;
        }

        // For submissions, we check for the full set of headers
        if (sheetName.endsWith('REQUEST')) {
            const headerValuesResponse = await sheets.spreadsheets.values.get({
                auth,
                spreadsheetId,
                range: `${sheetName}!1:1`,
            });

            const currentHeaders = headerValuesResponse.data.values ? headerValuesResponse.data.values[0] : [];
            const requiredHeaders = SUBMISSION_HEADERS;
            
            if (currentHeaders.length < requiredHeaders.length || !requiredHeaders.every(h => currentHeaders.includes(h))) {
                 console.log(`Headers in "${sheetName}" are outdated or incomplete. Updating...`);
                 await sheets.spreadsheets.values.update({
                    auth,
                    spreadsheetId,
                    range: `${sheetName}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [requiredHeaders] },
                });
                console.log(`Headers updated in "${sheetName}".`);
            }
        }
    } catch (error) {
        console.error(`Error ensuring sheet "${sheetName}" and headers exist:`, error);
        throw new Error(`Failed to initialize sheet: ${sheetName}.`);
    }
}


/**
 * Fetches a list of contractors from the "Contractors" Google Sheet.
 */
export async function getContractorList(): Promise<string[]> {
  const googleApi = await getSheetsApi();
  if (!googleApi) {
    console.log("Using hardcoded contractor data because Google Sheets API is not configured.");
    return [
      "شركة البناء الحديثة",
      "مقاولات الخليج",
      "هندسة المستقبل",
      "مجموعة التعمير",
    ];
  }
  
  try {
    const { sheets, auth, spreadsheetId } = googleApi;
    await ensureSheetAndHeaders(sheets, auth, spreadsheetId, CONTRACTORS_SHEET_NAME, CONTRACTOR_LIST_HEADERS);
    
    const range = `${CONTRACTORS_SHEET_NAME}!A2:A`; // Start from A2 to skip header

    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range,
    });

    const values = response.data.values;
    if (values && values.length > 0) {
      const contractorList = values.map(row => row[0]).filter(name => name);
      return [...new Set(contractorList)]; // Return unique values
    }
    return [];
  } catch (error) {
    console.error(`Error fetching data from ${CONTRACTORS_SHEET_NAME}:`, error);
    throw new Error(`Failed to fetch contractor list from ${CONTRACTORS_SHEET_NAME}.`);
  }
}

/**
 * Fetches a list of contract names from a specified Google Sheet based on the company.
 */
export async function getContractList(company: Company): Promise<string[]> {
  const dataSheetName = `${company} DATA`;
  
  const googleApi = await getSheetsApi();
  if (!googleApi) {
    console.log("Using hardcoded contract data because Google Sheets API is not configured.");
    return [
      "عقد مشروع A",
      "عقد مشروع B",
      "عقد صيانة",
    ];
  }
  
  try {
    const { sheets, auth, spreadsheetId } = googleApi;
    await ensureSheetAndHeaders(sheets, auth, spreadsheetId, dataSheetName, DATA_HEADERS);
    
    const range = `${dataSheetName}!A2:A`; // Start from A2 to skip header
    
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range,
    });

    const values = response.data.values;
    if (values && values.length > 0) {
      const contractList = values.map(row => row[0]).filter(name => name);
      return [...new Set(contractList)]; // Return unique values
    }
    return [];
  } catch (error) {
    console.error(`Error fetching contract data from ${dataSheetName}:`, error);
    throw new Error(`Failed to fetch contract list from ${dataSheetName}.`);
  }
}

/**
 * Fetches a list of work items from a specified Google Sheet based on the company.
 */
export async function getWorkItemList(company: Company): Promise<string[]> {
  const dataSheetName = `${company} DATA`;
  
  const googleApi = await getSheetsApi();
  if (!googleApi) {
    console.log("Using hardcoded work item data because Google Sheets API is not configured.");
    return [
      "بند 1",
      "بند 2",
      "بند 3",
    ];
  }
  
  try {
    const { sheets, auth, spreadsheetId } = googleApi;
    await ensureSheetAndHeaders(sheets, auth, spreadsheetId, dataSheetName, DATA_HEADERS);
    
    const range = `${dataSheetName}!B2:B`; // Start from B2 to skip header
    
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range,
    });

    const values = response.data.values;
    if (values && values.length > 0) {
      const workItemList = values.map(row => row[0]).filter(name => name);
      return [...new Set(workItemList)]; // Return unique values
    }
    return [];
  } catch (error) {
    console.error(`Error fetching work item data from ${dataSheetName}:`, error);
    throw new Error(`Failed to fetch work item list from ${dataSheetName}.`);
  }
}


export async function submitDeductions(payload: SubmitDeductionsPayload) {
  // Save a copy to the local mock store for immediate history display
  const grandTotal = payload.contractors.reduce((total, contractor) => 
     total + contractor.deductions.reduce((deductionTotal, deduction) => 
         deductionTotal + ((Number(deduction.quantity) || 0) * (Number(deduction.unitPrice) || 0)), 0), 0);
         
  const newSubmission: Submission = {
     reportId: randomUUID(),
     timestamp: new Date().toISOString(),
     userEmail: payload.userEmail,
     status: "قيد المراجعة", 
     company: payload.company,
     contractors: payload.contractors,
     grandTotal: grandTotal
  };
  
  mockSubmissions.push(newSubmission);

  const googleApi = await getSheetsApi();
  if (!googleApi) {
     console.warn("Google Sheets API not configured. Report saved locally for history. Not sent to sheet.");
     return { success: true, message: 'تم حفظ التقرير محلياً. لم يتم الإرسال لعدم وجود اتصال بـ Google.' };
  }

  const submissionsSheetName = `${payload.company} REQUEST`;
  try {
      const { sheets, auth, spreadsheetId } = googleApi;
      
      await ensureSheetAndHeaders(sheets, auth, spreadsheetId, submissionsSheetName, SUBMISSION_HEADERS);
      
      // Get current date and time in Cairo's timezone (UTC+3 for DST)
      const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Africa/Cairo"}));
      
      // Format to YYYY-MM-DD for consistency
      const date = now.toLocaleDateString('en-CA'); 
      // Format to HH:MM for consistency
      const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

      const rowsToAppend = payload.contractors.flatMap(contractor => 
        contractor.deductions.map(deduction => {
            const meterEquivalent = deduction.meterEquivalentValue ? `${deduction.meterEquivalentValue} ${deduction.meterEquivalentUnit}` : '';
            const quantity = Number(deduction.quantity) || 0;
            const unitPrice = Number(deduction.unitPrice) || 0;
            const total = quantity * unitPrice;
            
            return [
                date,
                time,
                payload.userEmail,
                payload.company,
                contractor.contractorName,
                deduction.contractName || '',
                deduction.itemName || '',
                deduction.workDescription || '',
                meterEquivalent,
                quantity,
                unitPrice,
                total,
                deduction.personName || '',
                contractor.notes || '',
                'قيد المراجعة' // Initial status
            ];
        })
      );

      if(rowsToAppend.length > 0) {
          await sheets.spreadsheets.values.append({
              auth,
              spreadsheetId,
              range: `${submissionsSheetName}!A1`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: rowsToAppend,
              },
          });
      }
      return { success: true, message: 'تم إرسال التقرير بنجاح للمراجعة.' };

  } catch (error: any) {
      let friendlyMessage = 'فشل إرسال البيانات إلى Google Sheets.';
      if (error.code === 403) {
          friendlyMessage = 'تم رفض الإذن. يرجى التأكد من أن بريد حساب الخدمة لديه صلاحية "Editor" على ملف Google Sheet.';
      } else if (error.code === 404) {
          friendlyMessage = `لم يتم العثور على الملف. يرجى التحقق مرة أخرى من GOOGLE_SHEET_ID في ملف .env.local الخاص بك.`;
      }
      
      throw new Error(friendlyMessage);
  }
}

type UserRole = 'user' | 'admin';

export async function getUserRoleByEmail(email: string): Promise<UserRole | null> {
    if (!email) return null;
    const googleApi = await getSheetsApi();
    if (!googleApi) {
        if (email.toLowerCase().trim() === 'admin@test.com') return 'admin';
        if (email.toLowerCase().trim() === 'user@test.com') return 'user';
        return null;
    }
    
    try {
        const { sheets, auth, spreadsheetId } = googleApi;
        await ensureSheetAndHeaders(sheets, auth, spreadsheetId, USERS_SHEET_NAME, USER_HEADERS);

        const range = `${USERS_SHEET_NAME}!A2:C`;
        const response = await sheets.spreadsheets.values.get({ auth, spreadsheetId, range });

        const rows = response.data.values;
        if (rows && rows.length > 0) {
            for (const row of rows) {
                const sheetEmail = (row[0] || '').trim().toLowerCase();
                if (sheetEmail === email.trim().toLowerCase()) {
                    const role = (row[2] || 'user').trim().toLowerCase();
                    return role === 'admin' ? 'admin' : 'user';
                }
            }
        }
    } catch (error: any) {
        console.error(`Error getting user role from sheet:`, error);
    }
    
    return null;
}

export async function validateUser(email: string, password_provided: string, expectedRole: UserRole): Promise<{isValid: boolean; role: UserRole | null}> {
    const googleApi = await getSheetsApi();
    if (!googleApi) {
        if (email === 'admin@test.com' && password_provided === '123' && expectedRole === 'admin') return { isValid: true, role: 'admin' };
        if (email === 'user@test.com' && password_provided === '123' && expectedRole === 'user') return { isValid: true, role: 'user' };
        console.warn("Google Sheets API not configured. Falling back to mock user.");
        return { isValid: false, role: null}; 
    }
    
    try {
        const { sheets, auth, spreadsheetId } = googleApi;
        await ensureSheetAndHeaders(sheets, auth, spreadsheetId, USERS_SHEET_NAME, USER_HEADERS);

        const range = `${USERS_SHEET_NAME}!A2:C`;
        const response = await sheets.spreadsheets.values.get({ auth, spreadsheetId, range });

        const rows = response.data.values;
        if (rows && rows.length > 0) {
            for (const row of rows) {
                const sheetEmail = (row[0] || '').trim().toLowerCase();
                const sheetPassword = (row[1] || '').trim();
                const sheetRole = (row[2] || 'user').trim().toLowerCase();

                if (sheetEmail === email.trim().toLowerCase() && sheetPassword === password_provided.trim() && sheetRole === expectedRole) {
                    return { isValid: true, role: sheetRole as UserRole };
                }
            }
        }
    } catch (error: any) {
        console.error(`Error validating user from sheet:`, error);
    }
    
    return { isValid: false, role: null };
}

interface GetHistoryParams {
    userEmail: string;
    startDate?: string;
    endDate?: string;
}


function parseSubmissionsFromRows(rows: any[]): Submission[] {
    const groupedByTimestamp: { [key: string]: any[] } = rows.reduce((acc, row) => {
        const timestampKey = `${row[0]} ${row[1]}`; // e.g., "2024-05-23 14:30"
        if (!acc[timestampKey]) {
            acc[timestampKey] = [];
        }
        acc[timestampKey].push(row);
        return acc;
    }, {});

    const submissions: Submission[] = Object.entries(groupedByTimestamp).map(([timestampKey, rows]) => {
        const firstRow = rows[0];
        const company = firstRow[3] as Company;
        const userEmail = firstRow[2];
        const status = firstRow[14] || 'قيد المراجعة';
        const timestamp = timestampKey;

        const contractorsMap: { [key: string]: Contractor } = {};

        rows.forEach(row => {
            const contractorName = row[4];
            const notes = row[13] || '';

            if (!contractorsMap[contractorName]) {
                contractorsMap[contractorName] = {
                    id: `contractor-${contractorName}`,
                    contractorName,
                    notes,
                    deductions: [],
                };
            }

            const [meterValue, meterUnit] = (row[8] || '').split(' ');
            
            const deduction: Deduction = {
                id: `deduction-${randomUUID()}`,
                contractName: row[5],
                itemName: row[6],
                workDescription: row[7],
                meterEquivalentValue: meterValue ? parseFloat(meterValue) : '',
                meterEquivalentUnit: meterUnit || '',
                quantity: parseFloat(row[9]),
                unitPrice: parseFloat(row[10]),
                personName: row[12],
            };
            contractorsMap[contractorName].deductions.push(deduction);
        });
        
        const contractors = Object.values(contractorsMap);
        const grandTotal = contractors.reduce((total, c) => 
            total + c.deductions.reduce((subTotal, d) => subTotal + (Number(d.quantity) * Number(d.unitPrice)), 0)
        , 0);

        return {
            reportId: `report-${timestampKey.replace(/\s|:/g, '-')}`,
            timestamp,
            userEmail,
            status,
            company,
            contractors,
            grandTotal
        };
    });

    return submissions.sort((a, b) => {
         if (a.timestamp < b.timestamp) return 1;
         if (a.timestamp > b.timestamp) return -1;
         return 0;
    });
}


/**
 * Fetches submission history from Google Sheets for a specific user within a date range.
 */
export async function getSubmissionHistory({ userEmail, startDate, endDate }: GetHistoryParams): Promise<Submission[]> {
    const googleApi = await getSheetsApi();
    if (!googleApi) {
        console.warn("Google Sheets API not configured. Returning local mock submissions for history.");
        // Return only local history if API is not available
        const localHistory = mockSubmissions.filter(s => s.userEmail === userEmail);
         if (startDate && endDate) {
            const interval = { start: startOfDay(new Date(startDate)), end: endOfDay(new Date(endDate)) };
            return localHistory.filter(s => isWithinInterval(new Date(s.timestamp), interval))
                                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        return JSON.parse(JSON.stringify(localHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())));
    }
    
    try {
        const { sheets, auth, spreadsheetId } = googleApi;
        const companies: Company[] = ["DMC", "CURVE"];
        let allUserRows: any[] = [];

        for (const company of companies) {
            const sheetName = `${company} REQUEST`;
            try {
                 await ensureSheetAndHeaders(sheets, auth, spreadsheetId, sheetName, SUBMISSION_HEADERS);
                 const response = await sheets.spreadsheets.values.get({
                    auth,
                    spreadsheetId,
                    range: `${sheetName}!A2:Z`,
                });

                if (response.data.values) {
                    const companyRows = response.data.values.filter(row => row[2] === userEmail);
                    allUserRows.push(...companyRows);
                }
            } catch (sheetError) {
                // Silently fail if a company sheet doesn't exist, but log it.
                console.warn(`Could not read from sheet "${sheetName}". It might not exist. Skipping.`, sheetError);
            }
        }

        let filteredRows = allUserRows;
        if (startDate && endDate) {
            filteredRows = allUserRows.filter(row => {
                const rowDate = row[0]; 
                // Basic validation for YYYY-MM-DD format
                if (typeof rowDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rowDate)) {
                    return false;
                }
                // String comparison works for YYYY-MM-DD
                return rowDate >= startDate && rowDate <= endDate;
            });
        }
        
        return parseSubmissionsFromRows(filteredRows);

    } catch (error) {
        console.error("Error fetching submission history from Google Sheets:", error);
        throw new Error("فشل في جلب سجل التقارير من Google Sheets.");
    }
}

/**
 * Fetches all submissions from Google Sheets for the admin dashboard.
 */
export async function getAllSubmissions(): Promise<Submission[]> {
    const googleApi = await getSheetsApi();
    if (!googleApi) {
        console.warn("Google Sheets API not configured. Returning local mock submissions for admin.");
        return JSON.parse(JSON.stringify(mockSubmissions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())));
    }
    
    try {
        const { sheets, auth, spreadsheetId } = googleApi;
        const companies: Company[] = ["DMC", "CURVE"];
        let allRows: any[] = [];

        for (const company of companies) {
            const sheetName = `${company} REQUEST`;
            try {
                 await ensureSheetAndHeaders(sheets, auth, spreadsheetId, sheetName, SUBMISSION_HEADERS);
                 const response = await sheets.spreadsheets.values.get({
                    auth,
                    spreadsheetId,
                    range: `${sheetName}!A2:Z`,
                });

                if (response.data.values) {
                    allRows.push(...response.data.values);
                }
            } catch (sheetError) {
                console.warn(`Could not read from sheet "${sheetName}". It might not exist. Skipping.`, sheetError);
            }
        }
        
        return parseSubmissionsFromRows(allRows);

    } catch (error) {
        console.error("Error fetching all submissions from Google Sheets:", error);
        throw new Error("فشل في جلب كل التقارير من Google Sheets.");
    }
}

/**
 * Updates the status of a report in the Google Sheet.
 */
export async function updateReportStatus(
  reportId: string, 
  company: Company, 
  newStatus: 'موافقة' | 'مرفوض',
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  const googleApi = await getSheetsApi();
  if (!googleApi) {
    // Update mock data for local testing
    const mockIndex = mockSubmissions.findIndex(s => s.reportId === reportId);
    if(mockIndex !== -1) {
        mockSubmissions[mockIndex].status = newStatus;
        return { success: true, message: "تم تحديث الحالة محلياً بنجاح."}
    }
    return { success: false, message: 'Google Sheets API is not configured.' };
  }
  
  const sheetName = `${company} REQUEST`;
  const { sheets, auth, spreadsheetId } = googleApi;

  try {
    // 1. Fetch all data to find the row numbers
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: `${sheetName}!A2:Z`, // Fetch all data
    });

    const rows = response.data.values;
    if (!rows) {
      throw new Error(`No data found in sheet: ${sheetName}`);
    }

    const rowIndicesToUpdate: number[] = [];
    rows.forEach((row, index) => {
        // Construct a comparable timestamp key from the row data (Date and Time columns)
        // e.g., "2024-05-23 14:30" becomes "report-2024-05-23-14-30"
        const comparableRowId = `report-${row[0]}-${row[1]}`.replace(/\s|:/g, '-');

        if (comparableRowId.startsWith(reportId)) { // Use startsWith to handle potential second differences
            rowIndicesToUpdate.push(index + 2); // +2 because sheet is 1-indexed and we started from A2
        }
    });

    if (rowIndicesToUpdate.length === 0) {
      throw new Error(`لم يتم العثور على التقرير بالمعرف: ${reportId}`);
    }

    // Get current date and time in Cairo's timezone
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Africa/Cairo"}));
    const approvalDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const approvalTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }); // HH:MM

    // 2. Prepare batch update requests for all found rows
    // Column O for Status, P for Approval Date, Q for Approval Time, R for Admin Email
    const requests = rowIndicesToUpdate.map(rowIndex => ({
        range: `${sheetName}!O${rowIndex}:R${rowIndex}`, 
        values: [[newStatus, approvalDate, approvalTime, adminEmail]]
    }));

    await sheets.spreadsheets.values.batchUpdate({
        auth,
        spreadsheetId,
        requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: requests
        }
    });

    return { success: true, message: `تم تحديث حالة التقرير إلى "${newStatus}" بنجاح.` };

  } catch (error) {
    console.error(`Failed to update status for report ${reportId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "فشل تحديث حالة التقرير.";
    throw new Error(errorMessage);
  }
}
