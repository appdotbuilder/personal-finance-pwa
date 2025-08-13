import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  Download, 
  FileText, 
  Database,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';
import { trpc } from '@/utils/trpc';

interface DataImportExportProps {
  onUpdate?: () => void;
}

export function DataImportExport({ onUpdate }: DataImportExportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Export settings
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'excel'>('csv');
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');

  // Parse CSV data
  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV must have at least a header and one data row');
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];
    
    // Expected headers: date, description, amount, type, category (optional), account (optional)
    const requiredHeaders = ['date', 'description', 'amount', 'type'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) continue;
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      
      // Validate and convert data
      try {
        data.push({
          date: row.date,
          description: row.description,
          amount: parseFloat(row.amount.replace(/[^\d.-]/g, '')),
          type: row.type.toLowerCase() as 'income' | 'expense' | 'transfer',
          category: row.category || undefined,
          account: row.account || undefined
        });
      } catch (error) {
        console.warn(`Skipping invalid row ${i + 1}:`, error);
      }
    }
    
    return data;
  };

  // Handle file import
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('idle');
    setImportMessage('');

    try {
      const text = await file.text();
      let data: any[] = [];

      // Parse based on file type
      if (file.name.endsWith('.csv')) {
        data = parseCSV(text);
      } else if (file.name.endsWith('.json')) {
        const jsonData = JSON.parse(text);
        data = Array.isArray(jsonData) ? jsonData : [jsonData];
      } else {
        throw new Error('Unsupported file format. Please use CSV or JSON.');
      }

      if (data.length === 0) {
        throw new Error('No valid data found in file');
      }

      // Simulate progress
      setImportProgress(25);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Import data
      setImportProgress(50);
      await trpc.importTransactions.mutate({
        data,
        defaultAccountId: undefined
      });

      setImportProgress(100);
      setImportStatus('success');
      setImportMessage(`Successfully imported ${data.length} transactions!`);
      onUpdate?.();

    } catch (error: any) {
      setImportStatus('error');
      setImportMessage(error.message || 'Import failed. Please check your file format.');
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const exportData = await trpc.exportTransactions.query({
        format: exportFormat,
        startDate: exportStartDate ? new Date(exportStartDate) : undefined,
        endDate: exportEndDate ? new Date(exportEndDate) : undefined,
        includeDeleted: false
      });

      // Create download link
      const blob = new Blob([exportData as any], {
        type: exportFormat === 'csv' ? 'text/csv' :
              exportFormat === 'json' ? 'application/json' :
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error: any) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="w-5 h-5 mr-2 text-indigo-600" />
          📤 Data Import & Export
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="import" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="flex items-center">
              <Upload className="w-4 h-4 mr-2" />
              Import Data
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Supported formats:</strong> CSV and JSON files. 
                CSV should include columns: date, description, amount, type (income/expense/transfer), 
                and optionally category and account.
              </AlertDescription>
            </Alert>

            {/* File Upload */}
            <div className="space-y-4">
              <Label htmlFor="import-file">Choose File to Import</Label>
              <Input
                id="import-file"
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleImport}
                disabled={isImporting}
              />
            </div>

            {/* Import Progress */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center">
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  <span className="text-sm">Importing data...</span>
                </div>
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-gray-600">{importProgress}% complete</p>
              </div>
            )}

            {/* Import Status */}
            {importStatus !== 'idle' && (
              <Alert className={
                importStatus === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }>
                {importStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={
                  importStatus === 'success' ? 'text-green-800' : 'text-red-800'
                }>
                  {importMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Sample Format */}
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle className="text-sm">Sample CSV Format</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
{`date,description,amount,type,category,account
2024-01-15,Grocery shopping,150000,expense,Food & Dining,Main Account
2024-01-16,Salary,5000000,income,Salary,Main Account
2024-01-17,Transfer to savings,1000000,transfer,,Savings Account`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Export your transaction data for backup, analysis, or migration to other applications.
              </AlertDescription>
            </Alert>

            {/* Export Options */}
            <div className="space-y-4">
              {/* Format Selection */}
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select
                  value={exportFormat}
                  onValueChange={(value: 'csv' | 'json' | 'excel') => setExportFormat(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        CSV (Comma Separated Values)
                      </div>
                    </SelectItem>
                    <SelectItem value="json">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        JSON (JavaScript Object Notation)
                      </div>
                    </SelectItem>
                    <SelectItem value="excel">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        Excel (XLSX)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date (Optional)</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={exportStartDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setExportStartDate(e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date (Optional)</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={exportEndDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setExportEndDate(e.target.value)
                    }
                  />
                </div>
              </div>

              {/* Export Button */}
              <Button 
                onClick={handleExport} 
                disabled={isExporting}
                className="w-full"
                size="lg"
              >
                {isExporting ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export {exportFormat.toUpperCase()}
                  </>
                )}
              </Button>
            </div>

            {/* Export Info */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="text-sm text-blue-800 space-y-2">
                  <p><strong>What gets exported:</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>All transaction data including amounts, dates, and descriptions</li>
                    <li>Account and category information</li>
                    <li>Transaction tags and notes</li>
                    <li>Date range filtering if specified</li>
                  </ul>
                  <p className="text-xs mt-2">
                    <strong>Note:</strong> Exported files do not contain sensitive account numbers or passwords.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}