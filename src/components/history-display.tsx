
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { getSubmissionHistory, type Submission } from '@/app/deductions/actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Inbox, ServerCrash, PlusCircle, AlertCircle, CalendarIcon, Search, FilePlus, History, LogOut } from "lucide-react";
import { cn } from '@/lib/utils';
import { useDeductionsStore } from '@/stores/deductions-store';
import { format, subDays, parse } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useToast } from '@/hooks/use-toast';


export default function HistoryDisplay() {
  const router = useRouter();
  const { email, isAuthenticated, logout } = useAuthStore();
  const resetDeductions = useDeductionsStore(state => state.reset);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  // Function to correctly format the timestamp from the sheet
  const formatSheetTimestamp = (timestamp: string) => {
    // timestamp can be 'YYYY-MM-DD HH:mm' from sheets or an ISO string from local submissions
    try {
        // First, try parsing the sheet format
        const dateObj = parse(timestamp, 'yyyy-MM-dd HH:mm', new Date());
        // Check if parsing was successful (returns a valid date)
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toLocaleString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
        }
    } catch {}
    
    // Fallback for ISO string format (from local mock data) or any other format
    try {
        const isoDate = new Date(timestamp);
        return isoDate.toLocaleString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Africa/Cairo' 
        });
    } catch {}
    
    // If all parsing fails, return a placeholder
    return "تاريخ غير صالح";
  };


  const fetchHistory = async (filterDate?: DateRange) => {
    if (isAuthenticated && email) {
      setHasSearched(true);
      setIsLoading(true);
      setError(null);
      
      const params = {
        userEmail: email,
        // Format to YYYY-MM-DD for string comparison on the server
        startDate: filterDate?.from ? format(filterDate.from, 'yyyy-MM-dd') : undefined,
        endDate: filterDate?.to ? format(filterDate.to, 'yyyy-MM-dd') : undefined,
      };

      try {
        const history = await getSubmissionHistory(params);
        setSubmissions(history);
      } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : "فشل تحميل سجل التقارير. الرجاء المحاولة مرة أخرى.";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSearch = () => {
    if (!date?.from || !date?.to) {
        toast({
            variant: "destructive",
            title: "نقص في البيانات",
            description: "الرجاء اختيار تاريخ بداية ونهاية للبحث.",
        });
        return;
    }
    fetchHistory(date);
  };

  const handleCreateNew = () => {
    resetDeductions();
    router.push('/deductions');
  }

  const handleLogout = () => {
    logout();
    router.replace('/');
  };
  
  const getStatusVariant = (status: string) => {
    if (status.includes('مرفوض')) return 'bg-red-500 hover:bg-red-600';
    if (status.includes('موافقة')) return 'bg-green-500 hover:bg-green-600';
    if (status.includes('قيد المراجعة')) return 'bg-yellow-500 hover:bg-yellow-600';
    return 'bg-gray-500 hover:bg-gray-600';
  };
  
  const calculateTotal = (deduction: any) => (Number(deduction.quantity) || 0) * (Number(deduction.unitPrice) || 0);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4 mt-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }
  
    if (error) {
      return (
        <div className="flex items-center justify-center p-4 mt-6">
          <Alert variant="destructive" className="max-w-lg">
            <ServerCrash className="h-4 w-4"/>
            <AlertTitle>حدث خطأ!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
             <Button onClick={handleSearch} className="mt-4">إعادة المحاولة</Button>
          </Alert>
        </div>
      );
    }

    if (submissions.length === 0 && hasSearched) {
       return (
          <div className="text-center py-16">
            <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">لا توجد تقارير في الفترة المحددة</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              حاول تغيير نطاق التاريخ أو قم بإرسال تقرير جديد.
            </p>
             <Alert className="mt-4 max-w-md mx-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>ملاحظة هامة</AlertTitle>
              <AlertDescription>
                يتم جلب هذا السجل مباشرة من ملف Google Sheet الخاص بك.
              </AlertDescription>
            </Alert>
          </div>
        );
    }
    
    if (!hasSearched) {
       return (
          <div className="text-center py-16">
            <Search className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">ابدا البحث في سجلك</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              اختر نطاق التاريخ في الأعلى ثم اضغط على "بحث" لعرض التقارير.
            </p>
          </div>
        );
    }

    return (
        <Accordion type="single" collapsible className="w-full space-y-4 mt-6">
        {submissions.map((submission) => (
          <AccordionItem value={submission.reportId} key={submission.reportId} className="border-b-0">
             <Card className="shadow-md">
                <AccordionTrigger className="p-6 hover:no-underline">
                    <div className="flex justify-between items-center w-full">
                        <div className="text-right space-y-1">
                            <h3 className="font-bold text-lg">تقرير بتاريخ: {formatSheetTimestamp(submission.timestamp)}</h3>
                            <p className="text-sm text-muted-foreground">جهة العمل: {submission.company}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-xl">{submission.grandTotal.toFixed(2)} جنيه</span>
                            <Badge className={cn("text-white", getStatusVariant(submission.status))}>{submission.status || 'قيد المراجعة'}</Badge>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                    <div className="space-y-4">
                    {submission.contractors.map((contractor, index) => (
                        <div key={index}>
                            <h4 className="font-headline text-xl text-primary mb-2">{contractor.contractorName}</h4>
                            <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-center">بند العمل</TableHead>
                                        <TableHead className="text-center w-1/3">بيان العمل</TableHead>
                                        <TableHead className="text-center">بالخصم علي</TableHead>
                                        <TableHead className="text-center">عدد اليوميات</TableHead>
                                        <TableHead className="text-center">الفئه</TableHead>
                                        <TableHead className="text-center">الإجمالي</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {contractor.deductions.map((d, dIndex) => (
                                    <TableRow key={dIndex}>
                                        <TableCell className="text-center">{d.itemName}</TableCell>
                                        <TableCell>{d.workDescription}</TableCell>
                                        <TableCell className="text-center font-medium text-red-500">{d.personName || '--'}</TableCell>
                                        <TableCell className="text-center">{d.quantity}</TableCell>
                                        <TableCell className="text-center">{Number(d.unitPrice).toFixed(2)}</TableCell>
                                        <TableCell className="text-center font-bold">{calculateTotal(d).toFixed(2)}</TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                            {contractor.notes && <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded-md">ملحوظة: {contractor.notes}</p>}
                        </div>
                    ))}
                    </div>
                </AccordionContent>
             </Card>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
            <div className='flex items-center gap-2'>
                <Button size="lg" variant="outline" onClick={handleCreateNew}>
                    <FilePlus className="ml-2 h-5 w-5" />
                    تقرير جديد
                </Button>
                <Button size="lg" disabled>
                     <History className="ml-2 h-5 w-5" />
                    سجل التقارير
                </Button>
            </div>
        </header>

        <Card className="p-4 shadow-sm mb-6">
            <CardHeader className="p-2">
                <CardTitle className="text-lg">فلترة السجل حسب التاريخ</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                            "w-full sm:w-[300px] justify-start text-right font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {date?.from ? (
                            date.to ? (
                                <>
                                {format(date.from, "dd, LLL, y")} -{" "}
                                {format(date.to, "dd, LLL, y")}
                                </>
                            ) : (
                                format(date.from, "dd, LLL, y")
                            )
                            ) : (
                            <span>اختر تاريخ</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={1}
                        />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleSearch} disabled={isLoading}>
                        <Search className="ml-2 h-4 w-4" />
                        {isLoading ? 'جاري البحث...' : 'بحث'}
                    </Button>
                    <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground mr-auto">
                        <LogOut className="ml-2 h-4 w-4" />
                        تسجيل خروج
                    </Button>
                </div>
            </CardContent>
        </Card>

        {renderContent()}

      </div>
    </div>
  );
}
