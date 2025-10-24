import { useEffect, useState } from 'react';
import { ediApi } from '../lib/api';
import type { EDITransaction } from '../types/models';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileText, AlertCircle, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function EDITransactionsPage() {
  const [transactions, setTransactions] = useState<EDITransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<EDITransaction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filters
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [transactionTypeFilter, statusFilter]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ediApi.getTransactions({
        transaction_type: transactionTypeFilter || undefined,
        status: statusFilter || undefined,
      });
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load EDI transactions');
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const openTransactionDetails = async (transaction: EDITransaction) => {
    try {
      // Fetch fresh details in case of updates
      const freshData = await ediApi.getTransaction(transaction.transaction_id);
      setSelectedTransaction(freshData);
      setDetailsOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load transaction details');
      console.error('Error loading transaction details:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <CheckCircle className="h-4 w-4" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4" />;
      case 'ERROR':
        return <AlertCircle className="h-4 w-4" />;
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'success' | 'destructive' | 'warning' | 'outline' => {
    switch (status) {
      case 'ACCEPTED':
        return 'success';
      case 'REJECTED':
      case 'ERROR':
        return 'destructive';
      case 'PENDING':
        return 'warning';
      default:
        return 'outline';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      '837': '837 - Healthcare Claim',
      '276': '276 - Claim Status Inquiry',
      '835': '835 - Payment/Remittance',
      '270': '270 - Eligibility Inquiry',
      '834': '834 - Enrollment/Maintenance',
    };
    return labels[type] || type;
  };

  const filteredTransactions = transactions.filter(t => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      t.transaction_id.toLowerCase().includes(searchLower) ||
      t.transaction_type.toLowerCase().includes(searchLower) ||
      (t.claim_reference && t.claim_reference.toLowerCase().includes(searchLower)) ||
      (t.patient_member_id && t.patient_member_id.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">EDI Transactions</h1>
          <p className="text-muted-foreground mt-1">
            Electronic Data Interchange transaction monitoring and management
          </p>
        </div>
        <Button onClick={loadTransactions} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Type</label>
              <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="837">837 - Healthcare Claim</SelectItem>
                  <SelectItem value="276">276 - Claim Status Inquiry</SelectItem>
                  <SelectItem value="835">835 - Payment/Remittance</SelectItem>
                  <SelectItem value="270">270 - Eligibility Inquiry</SelectItem>
                  <SelectItem value="834">834 - Enrollment/Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="ACCEPTED">Accepted</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Transaction ID, Claim #, Patient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => (
                <Card
                  key={transaction.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => openTransactionDetails(transaction)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-3">
                          <Badge variant={getStatusVariant(transaction.status)} className="gap-1">
                            {getStatusIcon(transaction.status)}
                            {transaction.status}
                          </Badge>
                          <span className="font-mono text-sm font-medium">
                            {transaction.transaction_id}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {getTransactionTypeLabel(transaction.transaction_type)}
                          </span>
                        </div>
                        
                        <div className="flex gap-6 text-sm">
                          {transaction.claim_reference && (
                            <span>
                              <span className="text-muted-foreground">Claim:</span>{' '}
                              <span className="font-medium">{transaction.claim_reference}</span>
                            </span>
                          )}
                          {transaction.patient_member_id && (
                            <span>
                              <span className="text-muted-foreground">Patient:</span>{' '}
                              <span className="font-medium">{transaction.patient_member_id}</span>
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {format(new Date(transaction.submitted_at), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>

                        {transaction.validation_errors && transaction.validation_errors.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <span className="text-sm text-destructive">
                              {transaction.validation_errors.length} validation error
                              {transaction.validation_errors.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Transaction Details</span>
              {selectedTransaction && (
                <Badge variant={getStatusVariant(selectedTransaction.status)} className="gap-1">
                  {getStatusIcon(selectedTransaction.status)}
                  {selectedTransaction.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedTransaction && `${selectedTransaction.transaction_id} - ${getTransactionTypeLabel(selectedTransaction.transaction_type)}`}
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="x12">X12 Content</TabsTrigger>
                <TabsTrigger value="validation">Validation</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Transaction ID</label>
                    <p className="font-mono text-sm mt-1">{selectedTransaction.transaction_id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <p className="text-sm mt-1">{getTransactionTypeLabel(selectedTransaction.transaction_type)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <p className="text-sm mt-1">{selectedTransaction.status}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="text-sm mt-1">
                      {format(new Date(selectedTransaction.submitted_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  {selectedTransaction.claim_reference && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Claim Reference</label>
                      <p className="text-sm mt-1">{selectedTransaction.claim_reference}</p>
                    </div>
                  )}
                  {selectedTransaction.patient_member_id && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Patient</label>
                      <p className="text-sm mt-1">{selectedTransaction.patient_member_id}</p>
                    </div>
                  )}
                  {selectedTransaction.response_content && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Response</label>
                      <ScrollArea className="h-32 w-full border rounded-md p-3 mt-1">
                        <pre className="text-xs">{selectedTransaction.response_content}</pre>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="x12">
                <ScrollArea className="h-96 w-full border rounded-md p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {selectedTransaction.x12_content}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="validation" className="space-y-4">
                {selectedTransaction.validation_errors && selectedTransaction.validation_errors.length > 0 ? (
                  <div className="space-y-3">
                    {selectedTransaction.validation_errors.map((error, index) => (
                      <Card key={index} className="border-destructive">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                            <div className="space-y-1 flex-1">
                              <p className="font-medium">{error.message}</p>
                              {error.segment && (
                                <p className="text-sm text-muted-foreground">
                                  Segment: <span className="font-mono">{error.segment}</span>
                                </p>
                              )}
                              {error.element && (
                                <p className="text-sm text-muted-foreground">
                                  Element: <span className="font-mono">{error.element}</span>
                                </p>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {error.code}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                    <p>No validation errors</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
