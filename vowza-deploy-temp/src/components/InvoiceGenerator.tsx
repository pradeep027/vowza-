import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, IndianRupee, Calendar, User, MapPin } from 'lucide-react';

interface InvoiceData {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  providerName: string;
  providerProfession: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  amount: number;
  platformFee: number;
  totalAmount: number;
  generatedAt: string;
}

const InvoiceGenerator = ({ data }: { data: InvoiceData }) => {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      // In a real implementation, you would use a library like jsPDF or html2canvas
      // For now, we'll create a simple text-based invoice
      const invoiceContent = `
INVOICE
================================
Invoice Number: ${data.invoiceNumber}
Date: ${new Date(data.generatedAt).toLocaleDateString()}

BILL TO:
${data.customerName}
${data.customerEmail}
${data.customerPhone}

SERVICE PROVIDER:
${data.providerName}
${data.providerProfession}

EVENT DETAILS:
Event: ${data.eventName}
Date: ${data.eventDate}
Time: ${data.eventTime}
Venue: ${data.venue}

PAYMENT DETAILS:
Service Amount: ₹${data.amount.toLocaleString()}
Platform Fee (5%): ₹${data.platformFee.toLocaleString()}
Total: ₹${data.totalAmount.toLocaleString()}

Payment Status: PAID
================================
Thank you for choosing Vowza!
      `;

      // Create a blob and download
      const blob = new Blob([invoiceContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.invoiceNumber}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating invoice:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="border-gold/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Invoice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4 border-b border-border">
          <h2 className="text-2xl font-bold text-gold">VOWZA</h2>
          <p className="text-sm text-muted-foreground">Event Services Marketplace</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invoice Number:</span>
            <span className="font-semibold">{data.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date:</span>
            <span>{new Date(data.generatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div>
            <p className="text-sm font-semibold mb-1">Bill To:</p>
            <p className="text-sm">{data.customerName}</p>
            <p className="text-sm text-muted-foreground">{data.customerEmail}</p>
            <p className="text-sm text-muted-foreground">{data.customerPhone}</p>
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">Service Provider:</p>
            <p className="text-sm">{data.providerName}</p>
            <p className="text-sm text-muted-foreground">{data.providerProfession}</p>
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">Event Details:</p>
            <p className="text-sm flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {data.eventDate} at {data.eventTime}
            </p>
            <p className="text-sm flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {data.venue}
            </p>
          </div>
        </div>

        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between">
            <span>Service Amount:</span>
            <span className="flex items-center gap-1">
              <IndianRupee className="w-4 h-4" />
              {data.amount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Platform Fee (5%):</span>
            <span className="flex items-center gap-1">
              <IndianRupee className="w-4 h-4" />
              {data.platformFee.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total:</span>
            <span className="text-gold flex items-center gap-1">
              <IndianRupee className="w-5 h-5" />
              {data.totalAmount.toLocaleString()}
            </span>
          </div>
        </div>

        <Button
          onClick={generatePDF}
          disabled={generating}
          className="w-full bg-gradient-gold hover:opacity-90"
        >
          <Download className="w-4 h-4 mr-2" />
          {generating ? 'Generating...' : 'Download Invoice'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default InvoiceGenerator;
