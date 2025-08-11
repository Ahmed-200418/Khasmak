
'use client';

import { useRouter } from 'next/navigation';
import { useDeductionsStore, type Deduction, type Company } from '@/stores/deductions-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from "@/hooks/use-toast";
import { submitDeductions } from '@/app/deductions/actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowRight, Send, Edit, AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function SummaryDisplay() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { company, contractors, reset: resetDeductions } = useDeductionsStore();
  const { email } = useAuthStore();
  
  const calculateTotal = (deduction: Deduction) => (Number(deduction.quantity) || 0) * (Number(deduction.unitPrice) || 0);
  
  const calculateContractorTotal = (deductions: Deduction[]) => {
    return deductions.reduce((total, d) => total + calculateTotal(d), 0);
  };

  const calculateGrandTotal = () => {
    return contractors.reduce((total, c) => total + calculateContractorTotal(c.deductions), 0);
  };

  const handleConfirm = async () => {
    if (!company) {
       toast({
        variant: "destructive",
        title: "خطأ فادح",
        description: "الجهة (DMC/CURVE) غير محددة. الرجاء العودة وإعادة المحاولة.",
      });
      router.push('/deductions');
      return;
    }

    if (!email) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "لم يتم العثور على بريد المستخدم. الرجاء تسجيل الدخول مرة أخرى.",
      });
      setIsSubmitting(false);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await submitDeductions({ company, contractors, userEmail: email });
      toast({
        title: "نجاح!",
        description: result.message,
        className: "bg-green-100 border-green-400 text-green-800",
      });
      resetDeductions();
      router.push('/history'); // Redirect to history page after submission
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "لم نتمكن من إرسال التقرير. الرجاء المحاولة مرة أخرى.";
      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: errorMessage,
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (contractors.length === 0 && !isSubmitting) {
    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
            <div className="max-w-md mx-auto text-center">
                <Alert>
                    <AlertCircle className="h-4 w-4"/>
                    <AlertTitle className="font-headline">لا توجد بيانات للمراجعة!</AlertTitle>
                    <AlertDescription>
                        يبدو أنك لم تقم بإدخال أي خصومات.
                    </AlertDescription>
                </Alert>
                <Button className="mt-4" onClick={() => router.push('/deductions')}>
                    العودة لإنشاء تقرير
                    <ArrowRight className="mr-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-headline text-3xl sm:text-4xl text-primary">
                مراجعة التقرير
              </h1>
              <p className="text-muted-foreground">الرجاء مراجعة البيانات بعناية قبل التأكيد.</p>
            </div>
             {company && (
                <div className="p-2 px-4 rounded-lg bg-secondary">
                    <span className="font-bold text-secondary-foreground text-xl">{company}</span>
                </div>
             )}
          </div>
        </header>

        <div className="space-y-6">
          {contractors.map((contractor) => (
            <Card key={contractor.id} className="shadow-md">
              <CardHeader>
                <CardTitle className="font-headline text-2xl">{contractor.contractorName}</CardTitle>
                {contractor.notes && <CardDescription>ملحوظة: {contractor.notes}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-center border-l">اسم العقد</TableHead>
                          <TableHead className="text-center border-l">بند العمل</TableHead>
                          <TableHead className="text-center border-l w-[25%]">بيان العمل</TableHead>
                          <TableHead className="text-center border-l">مايوازي بالمتر</TableHead>
                          <TableHead className="text-center border-l">بالخصم علي</TableHead>
                          <TableHead className="text-center border-l">عدد اليوميات</TableHead>
                          <TableHead className="text-center border-l">الفئة</TableHead>
                          <TableHead className="text-center">الإجمالي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contractor.deductions.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-medium text-center border-l">{d.contractName}</TableCell>
                            <TableCell className="text-center border-l">{d.itemName}</TableCell>
                            <TableCell className="align-top border-l">{d.workDescription}</TableCell>
                            <TableCell className="text-center border-l">{d.meterEquivalentValue ? `${d.meterEquivalentValue} ${d.meterEquivalentUnit}` : '--'}</TableCell>
                            <TableCell className="font-medium text-red-500 text-center border-l">{d.personName || '--'}</TableCell>
                            <TableCell className="text-center border-l">{d.quantity}</TableCell>
                            <TableCell className="text-center border-l">{Number(d.unitPrice).toFixed(2)}</TableCell>
                            <TableCell className="text-center font-medium">{calculateTotal(d).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                          <TableRow className="bg-muted">
                              <TableCell colSpan={7} className="font-bold text-base border-l">إجمالي المقاول</TableCell>
                              <TableCell className="text-center font-bold text-base">{calculateContractorTotal(contractor.deductions).toFixed(2)}</TableCell>
                          </TableRow>
                      </TableFooter>
                    </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8 p-4 bg-primary/10 border-primary/20">
            <div className="flex justify-between items-center">
                <p className="font-headline text-xl text-primary">الإجمالي الكلي للخصومات</p>
                <p className="font-bold text-2xl text-primary">{calculateGrandTotal().toFixed(2)} جنيه مصري</p>
            </div>
        </Card>

        <div className="mt-8 flex flex-col sm:flex-row-reverse gap-4">
          <Button className="w-full sm:flex-1 font-bold" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              'تأكيد وإرسال'
            )}
            <Send className="mr-2 h-4 w-4" />
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.back()} disabled={isSubmitting}>
            تعديل
            <Edit className="mr-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
