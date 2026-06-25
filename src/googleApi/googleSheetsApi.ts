import { getOAuth2Client } from './googleAuth.js';
import { sheets as sheetsClient, type sheets_v4 } from '@googleapis/sheets';
import { loggers } from '../utils/logger.js';

let sheetsInstance: sheets_v4.Sheets | null = null;

// Lazy initialization - only create sheets client when first needed
const getSheets = async (): Promise<sheets_v4.Sheets> => {
  if (!sheetsInstance) {
    const authClient = await getOAuth2Client();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sheetsInstance = sheetsClient({ version: 'v4', auth: authClient as any });
  }

  return sheetsInstance;
};

// Since we are appending, choose the beginning of the range
const range = 'Despesas!A2:E2';

export const getSheetData = async (): Promise<sheets_v4.Schema$ValueRange | undefined> => {
  try {
    const sheets = await getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'Despesas!A2:E',
    });

    return response.data as sheets_v4.Schema$ValueRange;
  } catch (error) {
    loggers.errorWithContext(error as Error, 'Google Sheets API');
    throw error;
  }
};

// Append values to the Google Sheet
// This function takes an array of arrays (values) and appends them to the specified range
export const appendValuesToSheet = async (values: string[][]) => {
  try {
    const sheets = await getSheets();
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return response.data;
  } catch (error) {
    loggers.errorWithContext(error as Error, 'Google Sheets API');
    throw error; // Re-throw to allow caller to handle the error
  }
};

/**
 * Read offboarding balances from the offboarding sheet
 * Returns a Map of userId -> amount (positive = receives money, negative = owes money)
 */
export async function getOffboardingBalances(): Promise<Map<number, number>> {
  const sheetId = process.env.OFFBOARDING_SHEET_ID;

  if (!sheetId) {
    throw new Error('OFFBOARDING_SHEET_ID environment variable is not set');
  }

  try {
    const sheets = await getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: `${sheetId}!A2:B`,
    });

    const balances = new Map<number, number>();
    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return balances;
    }

    for (const row of rows) {
      const userId = parseInt(row[0], 10);
      const amount = parseFloat(row[1]);

      if (!isNaN(userId) && !isNaN(amount)) {
        balances.set(userId, amount);
      }
    }

    loggers.sheetsOperation('getOffboardingBalances', true, { rowCount: balances.size });

    return balances;
  } catch (error) {
    loggers.errorWithContext(error as Error, 'Google Sheets API - getOffboardingBalances');
    throw error;
  }
}

export interface OnboardingData {
  nome: string;
  dataChegada: string;
  dataPartida: string;
  levaCarro: string;
  localPartida: string;
  observacoes: string;
  userId: number;
}

/**
 * Add onboarding data to Google Sheets
 */
export async function addOnboardingData(data: OnboardingData): Promise<void> {
  try {
    const sheets = await getSheets();

    const values = [
      [
        data.nome,
        data.dataChegada,
        data.dataPartida,
        data.levaCarro,
        data.localPartida,
        'Não',
        data.observacoes,
        String(data.userId),
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: `${process.env.ONBOARDING_SHEET_ID}!A:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    loggers.sheetsOperation('addOnboardingData', true, { data });
  } catch (error) {
    loggers.errorWithContext(error as Error, 'Google Sheets API - addOnboardingData');
    throw error;
  }
}
