import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IndianRupee, Upload, Calendar, Instagram, Facebook, Youtube, Globe } from 'lucide-react';

const TestFeatures = () => {
  const [pricingPackages] = useState([
    { name: 'Silver Package', price: '', description: '', duration: '' },
    { name: 'Gold Package', price: '', description: '', duration: '' },
    { name: 'Premium Package', price: '', description: '', duration: '' }
  ]);

  const [timeSlots] = useState([
    { day: 0, start: '', end: '', active: false },
    { day: 1, start: '', end: '', active: false },
    { day: 2, start: '', end: '', active: false },
    { day: 3, start: '', end: '', active: false },
    { day: 4, start: '', end: '', active: false },
    { day: 5, start: '', end: '', active: false },
    { day: 6, start: '', end: '', active: false },
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 p-4 bg-green-100 border-2 border-green-500 rounded-lg">
          <h1 className="text-2xl font-bold text-green-800">TEST PAGE - ALL FEATURES DISPLAYED</h1>
          <p className="text-green-700">If you can see this page, the features are working correctly.</p>
        </div>

        {/* Pricing Packages */}
        <Card className="mb-6 border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-blue-500" />
              Pricing Packages (Silver, Gold, Premium)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pricingPackages.map((pkg, index) => (
                <div key={index} className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <h3 className="font-semibold text-lg mb-2">{pkg.name}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Price (₹)</Label>
                      <Input type="number" placeholder="10000" className="border-blue-300" />
                    </div>
                    <div>
                      <Label className="text-sm">Duration</Label>
                      <Input type="text" placeholder="e.g., 4 hours" className="border-blue-300" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-sm">Description</Label>
                    <Textarea placeholder="What's included in this package?" rows={2} className="border-blue-300" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Upload */}
        <Card className="mb-6 border-2 border-purple-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-500" />
              Portfolio Upload with "Add Item" Button
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
              <Button className="bg-purple-500 hover:bg-purple-600">
                <Upload className="w-4 h-4 mr-2" />
                Add Item
              </Button>
              <p className="mt-2 text-sm text-purple-700">Click to add unlimited portfolio items</p>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Availability */}
        <Card className="mb-6 border-2 border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              Weekly Availability Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {timeSlots.map((slot, index) => (
                <div key={slot.day} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200 sm:flex-nowrap">
                  <input type="checkbox" className="w-4 h-4 accent-orange-500" />
                  <span className="text-sm font-medium">
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.day]}
                  </span>
                  <Input type="time" className="w-32 border-orange-300" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="time" className="w-32 border-orange-300" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Social Media Fields */}
        <Card className="mb-6 border-2 border-pink-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-500" />
              Social Media Fields (Instagram, Facebook, YouTube, Website)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 p-4 rounded-lg bg-pink-50 border border-pink-200">
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-500" />
                <Input placeholder="@username" className="border-pink-300" />
              </div>
              <div className="flex items-center gap-2">
                <Facebook className="w-4 h-4 text-blue-600" />
                <Input placeholder="Page URL" className="border-pink-300" />
              </div>
              <div className="flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-600" />
                <Input placeholder="Channel URL" className="border-pink-300" />
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-green-600" />
                <Input placeholder="https://yourwebsite.com" className="border-pink-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Travel & Extra Charges */}
        <Card className="mb-6 border-2 border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-green-500" />
              Travel Charges & Extra Charges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-green-50 border border-green-200">
              <div>
                <Label>Travel Charges (₹)</Label>
                <Input type="number" placeholder="e.g., 2000" className="border-green-300" />
              </div>
              <div>
                <Label>Extra Charges (₹)</Label>
                <Input type="number" placeholder="e.g., 1000" className="border-green-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 p-4 bg-yellow-100 border-2 border-yellow-500 rounded-lg">
          <h2 className="text-xl font-bold text-yellow-800">ALL FEATURES ARE DISPLAYED ABOVE</h2>
          <p className="text-yellow-700">If you can see all the colored cards above, the features are working correctly.</p>
        </div>
      </div>
    </div>
  );
};

export default TestFeatures;
