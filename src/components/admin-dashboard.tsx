
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { getAllSubmissions, updateReportStatus, type Submission } from '@/app/deductions/actions';
import type { Company } from '@/stores/deductions-store';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Inbox, ServerCrash, CheckCircle, XCircle, LogOut, Loader2 } from "lucide-react";
import { cn } from '@/lib/utils';
import { parse } from "date-fns";
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const { email: adminEmail, logout } = useAuthStore(state => ({ email: state.email, logout: state.logout }));
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null); // Holds the ID of the report being updated
  const [error, setError] = useState<string | null>(null);

  const formatSheetTimestamp = (timestamp: string) => {
    try {
      // Handles both 'YYYY-MM-DD HH:mm' and ISO string formats
      const dateObj = timestamp.includes('T') ? new Date(timestamp) : parse(timestamp, 'yyyy-MM-dd HH:mm', new Date());
      return dateObj.toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
       return timestamp;
    }
  };

  const fetchSubmissions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allSubmissions = await getAllSubmissions();
      setSubmissions(allSubmissions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "فشل تحميل التقارير.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);
  
  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleUpdateStatus = async (reportId: string, company: Company | null, status: 'موافقة' | 'مرفوض') => {
    if (!company) {
      toast({ variant: "destructive", title: "خطأ", description: "لم يتم تحديد الشركة في هذا التقرير." });
      return;
    }
    if (!adminEmail) {
      toast({ variant: "destructive", title: "خطأ", description: "لم يتم التعرف على هوية المدير. حاول تسجيل الدخول مرة أخرى." });
      return;
    }

    setIsUpdating(reportId);
    try {
      const result = await updateReportStatus(reportId, company, status, adminEmail);
      if (result.success) {
        toast({ title: "نجاح", description: result.message });
        // Refresh local state to reflect the change
        setSubmissions(prev => prev.map(sub => sub.reportId === reportId ? { ...sub, status } : sub));
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "فشل تحديث حالة التقرير.";
      toast({ variant: "destructive", title: "خطأ", description: errorMessage });
    } finally {
      setIsUpdating(null);
    }
  }

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
            <Button onClick={fetchSubmissions} className="mt-4">إعادة المحاولة</Button>
          </Alert>
        </div>
      );
    }

    if (submissions.length === 0) {
       return (
          <div className="text-center py-16">
            <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">لا توجد تقارير للمراجعة حالياً</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              عندما يقوم المستخدمون بإرسال تقارير جديدة، ستظهر هنا.
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
                    <div className="flex justify-between items-center w-full gap-4">
                        <div className="text-right space-y-1 flex-grow">
                            <h3 className="font-bold text-lg">تقرير بتاريخ: {formatSheetTimestamp(submission.timestamp)}</h3>
                            <p className="text-sm text-muted-foreground">مقدم من: {submission.userEmail}</p>
                            <p className="text-sm text-muted-foreground">جهة العمل: {submission.company}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                            <span className="font-bold text-xl">{submission.grandTotal.toFixed(2)} جنيه</span>
                            <Badge className={cn("text-white min-w-[100px] text-center justify-center", getStatusVariant(submission.status))}>{submission.status}</Badge>
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
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                        <Button 
                            variant="default" 
                            className="bg-green-600 hover:bg-green-700" 
                            onClick={() => handleUpdateStatus(submission.reportId, submission.company, 'موافقة')}
                            disabled={isUpdating === submission.reportId}
                        >
                            {isUpdating === submission.reportId ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <CheckCircle className="ml-2 h-4 w-4" />}
                            موافقة
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={() => handleUpdateStatus(submission.reportId, submission.company, 'مرفوض')}
                            disabled={isUpdating === submission.reportId}
                        >
                             {isUpdating === submission.reportId ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <XCircle className="ml-2 h-4 w-4" />}
                            رفض
                        </Button>
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
        <header className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <h1 className="font-headline text-3xl sm:text-4xl text-primary">
            لوحة تحكم المدير
          </h1>
          <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
            تسجيل خروج
            <LogOut className="mr-2 h-4 w-4" />
          </Button>
        </header>

        {renderContent()}

      </div>
    </div>
  );
}
