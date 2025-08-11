
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { AtSign, KeyRound, Loader2, User, Shield } from 'lucide-react';
import { useState, useTransition, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { validateUser, getUserRoleByEmail } from '@/app/deductions/actions';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


const userFormSchema = z.object({
  password: z.string().min(1, { message: 'الرجاء إدخال كلمة المرور.' }),
});
type UserFormValues = z.infer<typeof userFormSchema>;

const adminFormSchema = z.object({
    password: z.string().min(1, { message: 'الرجاء إدخال كلمة المرور.' }),
});
type AdminFormValues = z.infer<typeof adminFormSchema>;

export default function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null);
  const [isCheckingRole, startRoleCheck] = useTransition();

  const [isUserSubmitting, setIsUserSubmitting] = useState(false);
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);

  const userForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { password: '' },
  });

  const adminForm = useForm<AdminFormValues>({
    resolver: zodResolver(adminFormSchema),
    defaultValues: { password: '' },
  });
  
  // Debounce effect for role checking
  useEffect(() => {
    const handler = setTimeout(() => {
        if (email) {
            startRoleCheck(async () => {
                const role = await getUserRoleByEmail(email);
                setUserRole(role);
            });
        } else {
            setUserRole(null);
        }
    }, 500); // 500ms delay

    return () => {
        clearTimeout(handler);
    };
  }, [email]);

  async function onUserSubmit(values: UserFormValues) {
    setIsUserSubmitting(true);
    await handleLogin('user', values.password);
    setIsUserSubmitting(false);
  }

  async function onAdminSubmit(values: AdminFormValues) {
    setIsAdminSubmitting(true);
    await handleLogin('admin', values.password);
    setIsAdminSubmitting(false);
  }

  async function handleLogin(role: 'user' | 'admin', password: string) {
    if (!email) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "الرجاء إدخال البريد الإلكتروني أولاً.",
      });
      return;
    }

    try {
        const validationResult = await validateUser(email, password, role);

        if (validationResult.isValid) {
            login(email, validationResult.role!);
            toast({
                title: "تم تسجيل الدخول بنجاح",
                description: `مرحباً بك، ${email}`,
                className: "bg-green-100 border-green-400 text-green-800",
            });
            
            const targetPath = validationResult.role === 'admin' ? '/admin' : '/deductions';
            router.push(targetPath);
        } else {
             toast({
                variant: "destructive",
                title: "فشل تسجيل الدخول",
                description: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
            });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء محاولة تسجيل الدخول.";
        toast({
            variant: "destructive",
            title: "خطأ في النظام",
            description: errorMessage,
        });
    }
  }
  
  const isUserDisabled = userRole === 'admin';
  const isAdminDisabled = userRole === 'user';


  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-4xl shadow-lg animate-in fade-in-50 zoom-in-95 duration-500 overflow-hidden">
         <div className="p-8">
            <Label htmlFor='email'>البريد الإلكتروني الموحد</Label>
            <div className="relative mt-2">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    id="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 text-left" dir="ltr"
                />
                {isCheckingRole && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {userRole && !isCheckingRole && (
                <Badge variant={userRole === 'admin' ? 'destructive' : 'secondary'} className="mt-2">
                    {userRole === 'admin' ? 'حساب مدير' : 'حساب مستخدم'}
                </Badge>
            )}
         </div>

        <div className="flex flex-col md:flex-row">
          {/* User Login Section */}
          <div className={cn("w-full md:w-1/2 p-8 pt-0 transition-opacity", isUserDisabled && "opacity-50")}>
            <CardHeader className="text-center items-center p-0 mb-6">
               <User className="h-10 w-10 text-primary mb-2" />
               <CardTitle className="font-headline text-2xl pt-2">
                دخول المستخدم
               </CardTitle>
               <CardDescription>
                للمهندسين والمشرفين
               </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <Form {...userForm}>
                    <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-6">
                        <FormField
                            control={userForm.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>كلمة المرور</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input type="password" placeholder="••••••••" {...field} className="pl-10 text-left" dir="ltr" disabled={isUserDisabled}/>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full font-bold text-base py-6" disabled={isUserSubmitting || isUserDisabled || !userRole}>
                            {isUserSubmitting ? (
                                <>
                                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                    جاري التحقق...
                                </>
                            ) : ( 'دخول المستخدم' )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
          </div>

          <div className="hidden md:flex items-center justify-center">
            <Separator orientation="vertical" />
          </div>
           <div className="flex md:hidden items-center justify-center p-4">
            <Separator orientation="horizontal" />
          </div>


          {/* Admin Login Section */}
          <div className={cn("w-full md:w-1/2 p-8 pt-0 bg-muted/40 transition-opacity", isAdminDisabled && "opacity-50")}>
             <CardHeader className="text-center items-center p-0 mb-6">
               <Shield className="h-10 w-10 text-primary mb-2" />
               <CardTitle className="font-headline text-2xl pt-2">
                دخول المدير
               </CardTitle>
               <CardDescription>
                لمراجعة واعتماد التقارير
               </CardDescription>
            </CardHeader>
             <CardContent className="p-0">
               <Form {...adminForm}>
                    <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-6">
                        <FormField
                            control={adminForm.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>كلمة المرور</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input type="password" placeholder="••••••••" {...field} className="pl-10 text-left" dir="ltr" disabled={isAdminDisabled}/>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full font-bold text-base py-6" disabled={isAdminSubmitting || isAdminDisabled || !userRole}>
                            {isAdminSubmitting ? (
                                <>
                                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                    جاري التحقق...
                                </>
                            ) : ( 'دخول المدير' )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
          </div>

        </div>
      </Card>
    </main>
  );
}
