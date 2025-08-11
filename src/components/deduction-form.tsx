
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDeductionsStore, type Deduction, type Company } from '@/stores/deductions-store';
import { useAuthStore } from '@/stores/auth-store';
import { getContractorList, getContractList, getWorkItemList } from '@/app/deductions/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Trash2, PlusCircle, User, LogOut, ArrowLeft, Loader2, History, AlertCircle, FilePlus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const meterUnits = ["متر مسطح", "متر مربع", "متر مكعب"];

export default function DeductionForm() {
  const router = useRouter();
  const { 
    company,
    setCompany,
    contractors, 
    addContractor, 
    removeContractor,
    updateContractorName,
    updateContractorNotes,
    addDeduction,
    removeDeduction,
    updateDeduction,
    reset,
  } = useDeductionsStore();
  const logout = useAuthStore(state => state.logout);
  const [isMounted, setIsMounted] = useState(false);
  const [contractorOptions, setContractorOptions] = useState<string[]>([]);
  const [contractOptions, setContractOptions] = useState<string[]>([]);
  const [workItemOptions, setWorkItemOptions] = useState<string[]>([]);
  const [isLoadingCompanyData, setIsLoadingCompanyData] = useState(false);
  const [isLoadingContractors, setIsLoadingContractors] = useState(false);
  const { toast } = useToast();


  useEffect(() => {
    setIsMounted(true);
    // Fetch general contractor list on mount
    const fetchGeneralContractors = async () => {
      setIsLoadingContractors(true);
      try {
        const contractorList = await getContractorList();
        setContractorOptions(contractorList);
      } catch (error) {
        console.error("Failed to fetch contractor list:", error);
        toast({
          variant: "destructive",
          title: "فشل تحميل المقاولين",
          description: "لم نتمكن من تحميل قائمة المقاولين.",
        });
      } finally {
        setIsLoadingContractors(false);
      }
    };
    fetchGeneralContractors();
  }, [toast]);
  
  // Refetch data when company changes
  useEffect(() => {
    if (!company) {
      setContractOptions([]);
      setWorkItemOptions([]);
      return;
    }
    
    async function fetchData(selectedCompany: Company) {
      try {
        setIsLoadingCompanyData(true);
        // Reset lists to show loading state
        setContractOptions([]);
        setWorkItemOptions([]);

        const [contractList, workItemList] = await Promise.all([
          getContractList(selectedCompany),
          getWorkItemList(selectedCompany)
        ]);
        setContractOptions(contractList);
        setWorkItemOptions(workItemList);
      } catch (error) {
        console.error("Failed to fetch initial data for company:", company, error);
        toast({
          variant: "destructive",
          title: "فشل تحميل البيانات",
          description: `لم نتمكن من تحميل القوائم من ملف إكسل الخاص بـ ${company}.`,
        });
      } finally {
        setIsLoadingCompanyData(false);
      }
    }

    fetchData(company);
  }, [company, toast]);
  
  // Add a contractor if the list is empty and a company has been selected
  useEffect(() => {
    if (company && contractors.length === 0) {
      addContractor();
    }
  }, [company, contractors.length, addContractor]);

  const handleLogout = () => {
    logout();
    reset(); // Also reset deductions form
    router.replace('/');
  };

  const calculateTotal = (deduction: Deduction) => {
    return (Number(deduction.quantity) || 0) * (Number(deduction.unitPrice) || 0);
  };
  
  const isFormValid = () => {
    if (!company) return false;
    if (contractors.length === 0) return false;
    return contractors.every(c => 
      c.contractorName && c.deductions.length > 0 && c.deductions.every(d => d.contractName && d.itemName && d.workDescription && d.quantity && d.quantity > 0 && d.unitPrice !== '' && d.unitPrice >= 0)
    );
  };
  
  const FormLabel = ({ id, label, required = false, className = '' }: { id: string, label: string, required?: boolean, className?: string }) => (
    <Label htmlFor={id} className={`flex items-center ${className}`}>
      {label}
      {required && <span className="text-destructive mr-1">*</span>}
    </Label>
  );

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
            <div className='flex items-center gap-2'>
                <Button size="lg" disabled>
                    <FilePlus className="ml-2 h-5 w-5" />
                    تقرير جديد
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push('/history')}>
                    <History className="ml-2 h-5 w-5" />
                    سجل التقارير
                </Button>
            </div>
            <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
              تسجيل خروج
              <LogOut className="mr-2 h-4 w-4" />
            </Button>
        </header>
        
        <Card className="mb-6 shadow-md">
          <CardHeader>
             <CardTitle className="font-headline text-2xl">
               الجهة <span className="text-destructive mr-1">*</span>
             </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={company || undefined}
              onValueChange={(value) => {
                if (company !== value) {
                    reset(); // Reset form only if company changes
                }
                setCompany(value as "DMC" | "CURVE");
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="DMC" id="dmc" />
                <Label htmlFor="dmc" className="text-lg font-bold">DMC</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="CURVE" id="curve" />
                <Label htmlFor="curve" className="text-lg font-bold">CURVE</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {company ? (
          <div className="space-y-6">
            {contractors.map((contractor, contractorIndex) => (
              <Card key={contractor.id} className="shadow-md transition-all duration-300 animate-in fade-in-50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="font-headline text-2xl">
                    {`المقاول ${contractorIndex + 1}`}
                  </CardTitle>
                  {contractors.length > 1 && (
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeContractor(contractor.id)}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <FormLabel id={`contractor-${contractor.id}`} label="اسم المقاول" required />
                    <Select
                      value={contractor.contractorName}
                      onValueChange={(value) => updateContractorName(contractor.id, value)}
                      disabled={isLoadingContractors}
                    >
                      <SelectTrigger id={`contractor-${contractor.id}`} className="w-full md:w-1/2">
                         <SelectValue placeholder={isLoadingContractors ? '' : 'اختر مقاول...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingContractors ? (
                          <div className="flex items-center justify-center p-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : contractorOptions.length > 0 ? (
                          contractorOptions.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))
                        ) : <div className="p-2 text-center text-sm text-muted-foreground">لا توجد بيانات.</div>}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {contractor.deductions.map((deduction) => (
                     <div key={deduction.id} className="p-4 border rounded-lg space-y-4 relative bg-card transition-all">
                       {contractor.deductions.length > 1 && (
                          <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 left-2 text-destructive hover:bg-destructive/10"
                              onClick={() => removeDeduction(contractor.id, deduction.id)}
                          >
                              <Trash2 className="h-4 w-4" />
                          </Button>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                          <FormLabel id={`contract-name-${deduction.id}`} label="اسم العقد" required />
                          <Select
                            value={deduction.contractName}
                            onValueChange={(value) => updateDeduction(contractor.id, deduction.id, 'contractName', value)}
                            disabled={isLoadingCompanyData}
                          >
                            <SelectTrigger id={`contract-name-${deduction.id}`}>
                               <SelectValue placeholder={isLoadingCompanyData ? '' : 'اختر عقد...'} />
                            </SelectTrigger>
                            <SelectContent>
                              {isLoadingCompanyData ? (
                                <div className="flex items-center justify-center p-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              ) : contractOptions.length > 0 ? (
                                contractOptions.map(name => (
                                  <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))
                              ) : <div className="p-2 text-center text-sm text-muted-foreground">لا توجد بيانات.</div>}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <FormLabel id={`item-${deduction.id}`} label="بند العمل" required />
                          <Select
                            value={deduction.itemName}
                            onValueChange={(value) => updateDeduction(contractor.id, deduction.id, 'itemName', value)}
                            disabled={isLoadingCompanyData}
                          >
                            <SelectTrigger id={`item-${deduction.id}`}>
                               <SelectValue placeholder={isLoadingCompanyData ? '' : 'اختر بند...'} />
                            </SelectTrigger>
                            <SelectContent>
                              {isLoadingCompanyData ? (
                                <div className="flex items-center justify-center p-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              ) : workItemOptions.length > 0 ? (
                                workItemOptions.map(name => (
                                  <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))
                              ) : <div className="p-2 text-center text-sm text-muted-foreground">لا توجد بيانات.</div>}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                       <div className="grid grid-cols-1">
                        <div>
                            <FormLabel id={`work-desc-${deduction.id}`} label="بيان العمل" required />
                            <Textarea
                              id={`work-desc-${deduction.id}`}
                              value={deduction.workDescription || ''}
                              onChange={(e) => updateDeduction(contractor.id, deduction.id, 'workDescription', e.target.value)}
                              className="min-h-[60px]"
                            />
                          </div>
                       </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <FormLabel id={`meter-equiv-${deduction.id}`} label="ما يوازي بالمتر" />
                            <Input
                              id={`meter-equiv-${deduction.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={deduction.meterEquivalentValue || ''}
                              onChange={(e) => updateDeduction(contractor.id, deduction.id, 'meterEquivalentValue', parseFloat(e.target.value) || '')}
                            />
                          </div>
                          <div>
                              <FormLabel id={`meter-unit-${deduction.id}`} label="الوحدة" />
                               <Select
                                  value={deduction.meterEquivalentUnit}
                                  onValueChange={(value) => updateDeduction(contractor.id, deduction.id, 'meterEquivalentUnit', value)}
                                >
                                  <SelectTrigger id={`meter-unit-${deduction.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {meterUnits.map(unit => (
                                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <FormLabel id={`qty-${deduction.id}`} label="عدد اليوميات" required />
                            <Input
                              id={`qty-${deduction.id}`}
                              type="number"
                              min="0"
                              value={deduction.quantity || ''}
                              onChange={(e) => updateDeduction(contractor.id, deduction.id, 'quantity', parseFloat(e.target.value) || '')}
                            />
                          </div>
                          <div>
                            <FormLabel id={`price-${deduction.id}`} label="الفئة" required />
                            <Input
                              id={`price-${deduction.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={deduction.unitPrice || ''}
                              onChange={(e) => updateDeduction(contractor.id, deduction.id, 'unitPrice', parseFloat(e.target.value) || '')}
                            />
                          </div>
                          <div className="flex flex-col justify-end">
                              <Label>الإجمالي</Label>
                              <div className="p-2 h-10 border rounded-md bg-muted flex items-center">
                                  <span className="text-muted-foreground">{calculateTotal(deduction).toFixed(2)}</span>
                              </div>
                          </div>
                      </div>
                       <div className="grid grid-cols-1 md:w-1/2 mt-4">
                         <div>
                          <FormLabel id={`person-${deduction.id}`} label="بالخصم علي" />
                            <Select
                              value={deduction.personName}
                              onValueChange={(value) => updateDeduction(contractor.id, deduction.id, 'personName', value)}
                              disabled={isLoadingContractors}
                            >
                              <SelectTrigger id={`person-${deduction.id}`}>
                                 <SelectValue placeholder={isLoadingContractors ? '' : 'اختر اسم للخصم'} />
                              </SelectTrigger>
                              <SelectContent>
                                {isLoadingContractors ? (
                                  <div className="flex items-center justify-center p-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  </div>
                                ) : contractorOptions.length > 0 ? (
                                  contractorOptions.map(name => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                  ))
                                ) : <div className="p-2 text-center text-sm text-muted-foreground">لا توجد بيانات.</div>}
                              </SelectContent>
                            </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <Button variant="outline" onClick={() => addDeduction(contractor.id)}>
                      <PlusCircle className="ml-2 h-4 w-4" />
                      اضافه بيان اخر لنفس المقاول
                  </Button>

                  <Separator />

                  <div>
                    <FormLabel id={`notes-${contractor.id}`} label="ملحوظه" />
                    <Textarea
                      id={`notes-${contractor.id}`}
                      value={contractor.notes || ''}
                      onChange={(e) => updateContractorNotes(contractor.id, e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
           <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>الرجاء تحديد الجهة أولاً</AlertTitle>
              <AlertDescription>
                يجب عليك اختيار "DMC" أو "CURVE" لبدء إضافة بيانات التقرير والاتصال بملف الإكسل الصحيح.
              </AlertDescription>
            </Alert>
        )}

        <div className="mt-6 space-y-4">
          <Button variant="secondary" className="w-full" onClick={addContractor} disabled={!company}>
            <User className="ml-2 h-4 w-4" />
            أضف مقاول آخر
          </Button>
          <Button className="w-full font-bold text-lg py-6" onClick={() => router.push('/summary')} disabled={!isFormValid()}>
            مراجعة وإرسال
            <ArrowLeft className="mr-2 h-5 w-5" />
          </Button>
          {!isFormValid() && company && <p className="text-sm text-center text-destructive animate-pulse">الرجاء تعبئة جميع الحقول المطلوبة لكل الخصومات (المميزة بعلامة *).</p>}
        </div>
      </div>
    </div>
  );
}
