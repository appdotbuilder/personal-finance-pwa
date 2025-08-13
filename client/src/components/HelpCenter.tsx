import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  HelpCircle, 
  Book, 
  Video, 
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Smartphone,
  CreditCard,
  Target,
  TrendingUp,
  Brain,
  Download,
  Shield,
  Globe,
  Mail,
  Phone
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: 'general' | 'transactions' | 'accounts' | 'budgets' | 'goals' | 'ai' | 'security';
}

const faqData: FAQItem[] = [
  {
    question: 'Bagaimana cara menambahkan transaksi pertama saya?',
    answer: 'Klik tombol "Quick Actions" di dashboard, atau pergi ke tab Transactions. Pilih jenis transaksi (pemasukan/pengeluaran/transfer), masukkan jumlah, deskripsi, dan pilih akun. Klik "Add Transaction" untuk menyimpan.',
    category: 'transactions'
  },
  {
    question: 'Bagaimana cara mengatur budget bulanan?',
    answer: 'Pergi ke tab Budgets, klik "Create Budget". Pilih kategori pengeluaran, tentukan nama budget, jumlah anggaran, dan periode (biasanya 1 bulan). MoneyWise akan melacak pengeluaran Anda terhadap budget ini secara otomatis.',
    category: 'budgets'
  },
  {
    question: 'Apa itu AI Insights dan bagaimana cara kerjanya?',
    answer: 'AI Insights menganalisis pola keuangan Anda dan memberikan saran personal. Fitur ini melihat kebiasaan belanja, performa budget, dan memberikan rekomendasi untuk meningkatkan kesehatan keuangan Anda.',
    category: 'ai'
  },
  {
    question: 'Bagaimana cara membuat akun baru (misalnya tabungan)?',
    answer: 'Di tab Accounts, klik "Add Account". Pilih jenis akun (tabungan, giro, kartu kredit, dll), beri nama, tentukan saldo awal, dan pilih warna untuk identifikasi visual.',
    category: 'accounts'
  },
  {
    question: 'Apakah data keuangan saya aman?',
    answer: 'Ya, MoneyWise menggunakan enkripsi tingkat bank dan Supabase Row-Level Security (RLS). Data Anda hanya bisa diakses oleh Anda sendiri dan disimpan dengan standar keamanan tinggi.',
    category: 'security'
  },
  {
    question: 'Bagaimana cara mengimpor data dari aplikasi lain?',
    answer: 'Gunakan fitur Import/Export di bagian bawah dashboard. MoneyWise mendukung format CSV dan JSON. Pastikan file Anda memiliki kolom: date, description, amount, type.',
    category: 'general'
  },
  {
    question: 'Bagaimana cara menetapkan target tabungan?',
    answer: 'Di tab Goals, klik "Create Goal". Tentukan nama tujuan (misalnya "Dana Darurat"), pilih akun tabungan, set target jumlah dan tanggal target. MoneyWise akan melacak progress Anda.',
    category: 'goals'
  },
  {
    question: 'Bisakah saya menggunakan MoneyWise secara offline?',
    answer: 'MoneyWise adalah Progressive Web App (PWA) dengan dukungan offline terbatas. Anda bisa melihat data yang sudah dimuat, tapi perlu koneksi internet untuk sinkronisasi dan update data.',
    category: 'general'
  }
];

const quickGuides = [
  {
    title: 'Memulai dengan MoneyWise',
    icon: <Smartphone className="w-5 h-5" />,
    steps: [
      'Buat akun pertama (misalnya rekening utama)',
      'Tambahkan beberapa kategori pengeluaran',
      'Catat transaksi harian Anda',
      'Buat budget bulanan',
      'Tetapkan target tabungan'
    ]
  },
  {
    title: 'Mengelola Transaksi Harian',
    icon: <CreditCard className="w-5 h-5" />,
    steps: [
      'Gunakan Quick Actions di dashboard untuk transaksi cepat',
      'Tambahkan notes dan tags untuk detail lebih',
      'Upload foto struk (jika perlu)',
      'Kategorikan setiap transaksi',
      'Review transaksi mingguan di tab Transactions'
    ]
  },
  {
    title: 'Optimasi Budget dengan AI',
    icon: <Brain className="w-5 h-5" />,
    steps: [
      'Biarkan AI menganalisis pola belanja Anda',
      'Review AI Insights setiap minggu',
      'Implementasikan saran yang diberikan',
      'Adjust budget berdasarkan rekomendasi',
      'Monitor Financial Health Score Anda'
    ]
  }
];

export function HelpCenter() {
  const [openFAQs, setOpenFAQs] = useState<Set<number>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const toggleFAQ = (index: number) => {
    const newOpenFAQs = new Set(openFAQs);
    if (newOpenFAQs.has(index)) {
      newOpenFAQs.delete(index);
    } else {
      newOpenFAQs.add(index);
    }
    setOpenFAQs(newOpenFAQs);
  };

  const filteredFAQs = selectedCategory === 'all' 
    ? faqData 
    : faqData.filter(faq => faq.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <HelpCircle className="w-5 h-5 mr-2 text-purple-600" />
            🆘 Help Center
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs defaultValue="faq" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="guides">Quick Guides</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="w-5 h-5 mr-2" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 mb-6">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                >
                  All
                </Button>
                <Button
                  variant={selectedCategory === 'general' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('general')}
                >
                  General
                </Button>
                <Button
                  variant={selectedCategory === 'transactions' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('transactions')}
                >
                  Transactions
                </Button>
                <Button
                  variant={selectedCategory === 'budgets' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('budgets')}
                >
                  Budgets
                </Button>
                <Button
                  variant={selectedCategory === 'ai' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('ai')}
                >
                  AI Insights
                </Button>
              </div>

              {/* FAQ Items */}
              <div className="space-y-3">
                {filteredFAQs.map((faq, index) => (
                  <Collapsible key={index}>
                    <CollapsibleTrigger
                      className="flex w-full items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
                      onClick={() => toggleFAQ(index)}
                    >
                      <span className="text-left font-medium">{faq.question}</span>
                      {openFAQs.has(index) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-4 text-gray-700 text-sm leading-relaxed">
                      {faq.answer}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Guides Tab */}
        <TabsContent value="guides" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickGuides.map((guide, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    {guide.icon}
                    <span className="ml-2">{guide.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2">
                    {guide.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex items-start">
                        <Badge variant="outline" className="mr-2 mt-0.5 w-6 h-6 p-0 flex items-center justify-center text-xs">
                          {stepIndex + 1}
                        </Badge>
                        <span className="text-sm text-gray-700">{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Core Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                  Core Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Transaction Tracking:</strong> Record income, expenses, and transfers with detailed categorization
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Multi-Account Support:</strong> Manage checking, savings, credit cards, and investment accounts
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Budget Management:</strong> Set monthly budgets and track spending against targets
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Savings Goals:</strong> Set and track progress towards financial objectives
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Advanced Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-purple-600" />
                  Advanced Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>AI-Powered Insights:</strong> Get personalized financial advice and spending analysis
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Financial Reports:</strong> Comprehensive analytics and visualizations
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Data Import/Export:</strong> CSV, JSON, and Excel format support
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Progressive Web App:</strong> Install on mobile devices for native-like experience
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Indonesian Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="w-5 h-5 mr-2 text-red-600" />
                  Indonesian Localization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Rupiah Currency:</strong> Full IDR formatting with proper thousand separators
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Indonesian Categories:</strong> Pre-configured categories for Indonesian lifestyle
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Local Banking:</strong> Support for Indonesian banking terms and formats
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Time Format:</strong> Indonesian date and time formatting (id-ID locale)
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Security Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-green-600" />
                  Security & Privacy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Bank-Level Security:</strong> Data encrypted at rest and in transit
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Row-Level Security:</strong> Your data is isolated and protected
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>No Data Sharing:</strong> Your financial data stays private
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <strong>Secure Authentication:</strong> OAuth and JWT token security
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="w-5 h-5 mr-2 text-blue-600" />
                  Get Help
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium">Email Support</p>
                    <p className="text-sm text-gray-600">support@moneywise.id</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium">WhatsApp Support</p>
                    <p className="text-sm text-gray-600">+62 812 3456 7890</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <MessageCircle className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium">Community Forum</p>
                    <p className="text-sm text-gray-600">forum.moneywise.id</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Book className="w-5 h-5 mr-2 text-green-600" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <Video className="w-4 h-4 mr-2" />
                  Video Tutorials
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  <Book className="w-4 h-4 mr-2" />
                  User Manual
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Quick Start Guide
                </Button>

                <Button variant="outline" className="w-full justify-start">
                  <Globe className="w-4 h-4 mr-2" />
                  Visit Website
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>💡 Tips for Better Financial Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Daily Habits</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Record transactions immediately</li>
                      <li>• Check your budget progress daily</li>
                      <li>• Review AI insights weekly</li>
                      <li>• Update savings goals monthly</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Best Practices</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Set realistic budgets</li>
                      <li>• Use categories consistently</li>
                      <li>• Keep emergency fund target</li>
                      <li>• Export data regularly for backup</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}