/**
 * Enhanced Claim Submission Modal with Medical Aid Business Logic
 * Includes benefit validation, pre-authorization checks, and financial calculations
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, AlertCircle, CheckCircle, Clock, DollarSign, FileText } from 'lucide-react';
import { CurrencyUtils, createCurrencyInputProps } from '@/lib/currency-enhanced';
import { MedicalAidApi, ErrorHandler, apiClient } from '@/lib/api-enhanced';
import { formatFullName } from '@/lib/format-name';
import { capitalizeFirst } from '@/lib/format-text';
import type { 
  Patient, 
  BenefitType, 
  BenefitValidationResult, 
  ClaimSubmissionForm 
} from '@/types/medical-aid-enhanced';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ValidationStep {
  id: string;
  name: string;
  status: 'pending' | 'checking' | 'complete' | 'error';
  message?: string;
  details?: any;
}

interface FinancialBreakdown {
  claimAmount: string;
  deductible: string;
  copaymentFixed: string;
  copaymentPercentage: string;
  totalCopayment: string;
  patientTotal: string;
  schemePayable: string;
}

export function EnhancedClaimSubmissionModal({ open, onOpenChange }: Props) {
  // Form state
  const [formData, setFormData] = useState<ClaimSubmissionForm>({
    patient: 0,
    service_type: 0,
    cost: '',
    date_of_service: new Date().toISOString().split('T')[0],
    diagnosis_code: '',
    procedure_code: '',
    notes: '',
    preauth_number: '',
    urgency: 'ROUTINE'
  });

  // Data state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [benefitTypes, setBenefitTypes] = useState<BenefitType[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Validation state
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([]);
  const [validationResult, setValidationResult] = useState<BenefitValidationResult | null>(null);
  const [financialBreakdown, setFinancialBreakdown] = useState<FinancialBreakdown | null>(null);

  // UI state
  const [currentStep, setCurrentStep] = useState<'form' | 'validation' | 'review'>('form');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    
    loadInitialData();
  }, [open]);

  const resetForm = () => {
    setFormData({
      patient: 0,
      service_type: 0,
      cost: '',
      date_of_service: new Date().toISOString().split('T')[0],
      diagnosis_code: '',
      procedure_code: '',
      notes: '',
      preauth_number: '',
      urgency: 'ROUTINE'
    });
    setCurrentStep('form');
    setValidationResult(null);
    setFinancialBreakdown(null);
    setValidationSteps([]);
    setError(null);
    setSelectedPatient(null);
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [patientsRes, benefitTypesRes] = await Promise.all([
        apiClient.getAllPages<Patient>('/api/patients/'),
        apiClient.getAllPages<BenefitType>('/api/schemes/benefit-types/')
      ]);
      
      setPatients(patientsRes);
      setBenefitTypes(benefitTypesRes.filter((bt: BenefitType) => bt.name.toLowerCase() !== 'add new'));
    } catch (err) {
      setError(ErrorHandler.extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePatientChange = async (patientId: number) => {
    const patient = patients.find(p => p.id === patientId);
    setSelectedPatient(patient || null);
    setFormData(prev => ({ ...prev, patient: patientId }));
    
    if (patient) {
      // Load patient-specific data
      try {
        const schemeDetails = await MedicalAidApi.getMemberSchemeDetails(patientId);
        // Update UI with scheme details if needed
      } catch (err) {
        console.warn('Could not load scheme details:', err);
      }
    }
  };

  const handleCostChange = (value: string) => {
    const parsed = CurrencyUtils.parseDecimal(value);
    setFormData(prev => ({ ...prev, cost: parsed.value }));
    
    if (!parsed.isValid && value !== '') {
      setError(parsed.error || 'Invalid amount format');
    } else {
      setError(null);
    }
  };

  const validateClaim = async () => {
    if (!formData.patient || !formData.service_type || !formData.cost) {
      setError('Please fill in all required fields');
      return;
    }

    setCurrentStep('validation');
    setLoading(true);

    const steps: ValidationStep[] = [
      { id: 'member', name: 'Member Eligibility', status: 'pending' },
      { id: 'benefits', name: 'Benefit Coverage', status: 'pending' },
      { id: 'preauth', name: 'Pre-Authorization', status: 'pending' },
      { id: 'financial', name: 'Financial Calculation', status: 'pending' }
    ];

    setValidationSteps(steps);

    try {
      // Step 1: Member Eligibility
      setValidationSteps(prev => prev.map(step => 
        step.id === 'member' 
          ? { ...step, status: 'checking' }
          : step
      ));

      // Step 2: Benefit Coverage Check
      setValidationSteps(prev => prev.map(step => 
        step.id === 'member' 
          ? { ...step, status: 'complete', message: 'Member is active and eligible' }
          : step.id === 'benefits'
          ? { ...step, status: 'checking' }
          : step
      ));

      const benefitCheck = await MedicalAidApi.getBenefitUtilization(
        formData.patient,
        formData.service_type,
        'current'
      ) as any;

      // Step 3: Pre-Authorization Check
      setValidationSteps(prev => prev.map(step => 
        step.id === 'benefits' 
          ? { ...step, status: 'complete', message: 'Coverage available' }
          : step.id === 'preauth'
          ? { ...step, status: 'checking' }
          : step
      ));

      const preAuthCheck = await MedicalAidApi.checkPreAuthRequirement(
        formData.patient,
        formData.service_type,
        formData.cost
      ) as any;

      // Step 4: Financial Calculation
      setValidationSteps(prev => prev.map(step => 
        step.id === 'preauth' 
          ? { 
              ...step, 
              status: (preAuthCheck?.is_required || false) ? 'error' : 'complete',
              message: (preAuthCheck?.is_required || false)
                ? `Pre-authorization required for amounts over ${CurrencyUtils.format(preAuthCheck?.threshold_amount || 0)}`
                : 'No pre-authorization required'
            }
          : step.id === 'financial'
          ? { ...step, status: 'checking' }
          : step
      ));

      const validationResponse = await MedicalAidApi.validateClaim({
        patient: formData.patient,
        service_type: formData.service_type,
        cost: formData.cost
      }) as any;

      // Calculate financial breakdown
      const breakdown = CurrencyUtils.calculatePatientResponsibility(
        formData.cost,
        validationResponse?.validation_details?.patient_responsibility?.deductible || '0.00',
        validationResponse?.validation_details?.patient_responsibility?.copayment_fixed || '0.00',
        validationResponse?.validation_details?.patient_responsibility?.copayment_percentage || '0.00'
      );

      setFinancialBreakdown(breakdown);
      setValidationResult({
        is_valid: validationResponse?.approved || false,
        coverage_available: true,
        pre_auth_required: preAuthCheck?.is_required || false,
        estimated_patient_responsibility: breakdown.patientTotal,
        estimated_scheme_payment: breakdown.schemePayable,
        warnings: [],
        errors: validationResponse?.approved ? [] : [validationResponse?.reason || 'Validation failed']
      });

      setValidationSteps(prev => prev.map(step => 
        step.id === 'financial' 
          ? { 
              ...step, 
              status: 'complete',
              message: `Patient pays ${CurrencyUtils.format(breakdown.patientTotal)}, Scheme pays ${CurrencyUtils.format(breakdown.schemePayable)}`
            }
          : step
      ));

      if (validationResponse?.approved && !preAuthCheck?.is_required) {
        setCurrentStep('review');
      }

    } catch (err) {
      const errorMessage = ErrorHandler.extractErrorMessage(err);
      setError(errorMessage);
      
      setValidationSteps(prev => prev.map(step => 
        step.status === 'checking' 
          ? { ...step, status: 'error', message: errorMessage }
          : step
      ));
    } finally {
      setLoading(false);
    }
  };

  const submitClaim = async () => {
    if (!validationResult?.is_valid) {
      setError('Claim validation failed. Please resolve issues before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await MedicalAidApi.submitClaim({
        ...formData,
        cost: formData.cost
      });

      onOpenChange(false);
      // Show success message - you can add toast notification here
    } catch (err: any) {
      const errorMessage = ErrorHandler.extractErrorMessage(err);
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const renderFormStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="patient">Member *</Label>
        <select 
          id="patient" 
          className="h-9 w-full rounded-md border bg-background px-3 text-sm" 
          value={formData.patient} 
          onChange={(e) => handlePatientChange(Number(e.target.value))}
          required
        >
          <option value={0} disabled>Select member...</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {formatFullName(p.first_name, p.last_name)} ({p.member_id})
            </option>
          ))}
        </select>
      </div>

      {selectedPatient && (
        <div className="p-3 bg-muted rounded-lg text-sm">
          <div className="font-medium">{formatFullName(selectedPatient.first_name, selectedPatient.last_name)}</div>
          <div className="text-muted-foreground">
            {selectedPatient.scheme_name} • {selectedPatient.relationship} • Status: {selectedPatient.status}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="serviceType">Service Type *</Label>
          <select 
            id="serviceType" 
            className="h-9 w-full rounded-md border bg-background px-3 text-sm" 
            value={formData.service_type} 
            onChange={(e) => setFormData(prev => ({ ...prev, service_type: Number(e.target.value) }))}
            required
          >
            <option value={0} disabled>Select service...</option>
            {benefitTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>{bt.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost">Cost (MWK) *</Label>
          <Input 
            id="cost" 
            {...createCurrencyInputProps(formData.cost, handleCostChange, { 
              placeholder: '0.00',
              required: true 
            })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dateOfService">Date of Service</Label>
          <Input
            id="dateOfService"
            type="date"
            value={formData.date_of_service}
            onChange={(e) => setFormData(prev => ({ ...prev, date_of_service: e.target.value }))}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="urgency">Urgency</Label>
          <select 
            id="urgency" 
            className="h-9 w-full rounded-md border bg-background px-3 text-sm" 
            value={formData.urgency} 
            onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value as any }))}
          >
            <option value="ROUTINE">Routine</option>
            <option value="URGENT">Urgent</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="diagnosisCode">Diagnosis Code</Label>
          <Input
            id="diagnosisCode"
            value={formData.diagnosis_code}
            onChange={(e) => setFormData(prev => ({ ...prev, diagnosis_code: e.target.value }))}
            placeholder="ICD-10 code"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="procedureCode">Procedure Code</Label>
          <Input
            id="procedureCode"
            value={formData.procedure_code}
            onChange={(e) => setFormData(prev => ({ ...prev, procedure_code: e.target.value }))}
            placeholder="CPT code"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Clinical Notes (Optional)</Label>
        <textarea
          id="notes"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Add clinical notes, treatment details, or other relevant information..."
          maxLength={500}
        />
        <div className="text-xs text-muted-foreground text-right">
          {(formData.notes || '').length}/500 characters
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button 
          type="button" 
          onClick={validateClaim} 
          disabled={!formData.patient || !formData.service_type || !formData.cost || loading}
        >
          {loading ? 'Validating...' : 'Validate Claim'}
        </Button>
      </div>
    </div>
  );

  const renderValidationStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">Validating Claim</h3>
        <p className="text-sm text-muted-foreground">
          Checking eligibility, coverage, and requirements...
        </p>
      </div>

      <div className="space-y-3">
        {validationSteps.map((step) => (
          <div key={step.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <div className="flex-shrink-0">
              {step.status === 'pending' && <Clock className="h-5 w-5 text-muted-foreground" />}
              {step.status === 'checking' && (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
              {step.status === 'complete' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {step.status === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}
            </div>
            <div className="flex-1">
              <div className="font-medium">{step.name}</div>
              {step.message && (
                <div className={`text-sm ${
                  step.status === 'error' ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {step.message}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {validationResult && currentStep === 'validation' && (
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCurrentStep('form')}>
            Back to Form
          </Button>
          {validationResult.is_valid && !validationResult.pre_auth_required && (
            <Button onClick={() => setCurrentStep('review')}>
              Continue to Review
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">Review & Submit</h3>
        <p className="text-sm text-muted-foreground">
          Please review the claim details and financial breakdown
        </p>
      </div>

      {financialBreakdown && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financial Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Claim Amount:</span>
              <span className="font-medium">{CurrencyUtils.format(financialBreakdown.claimAmount)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Deductible:</span>
              <span>-{CurrencyUtils.format(financialBreakdown.deductible)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Copayment:</span>
              <span>-{CurrencyUtils.format(financialBreakdown.totalCopayment)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Patient Responsibility:</span>
              <span className="text-red-600">{CurrencyUtils.format(financialBreakdown.patientTotal)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Scheme Payable:</span>
              <span className="text-green-600">{CurrencyUtils.format(financialBreakdown.schemePayable)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Claim Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Member:</span>
            <span>{formatFullName(selectedPatient?.first_name, selectedPatient?.last_name)} ({selectedPatient?.member_id})</span>
          </div>
          <div className="flex justify-between">
            <span>Service:</span>
            <span>{capitalizeFirst(benefitTypes.find(bt => bt.id === formData.service_type)?.name)}</span>
          </div>
          <div className="flex justify-between">
            <span>Date of Service:</span>
            <span>{new Date(formData.date_of_service).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Urgency:</span>
            <Badge variant={formData.urgency === 'EMERGENCY' ? 'destructive' : 'outline'}>
              {formData.urgency}
            </Badge>
          </div>
          {formData.diagnosis_code && (
            <div className="flex justify-between">
              <span>Diagnosis:</span>
              <span>{formData.diagnosis_code}</span>
            </div>
          )}
          {formData.procedure_code && (
            <div className="flex justify-between">
              <span>Procedure:</span>
              <span>{formData.procedure_code}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setCurrentStep('validation')}>
          Back to Validation
        </Button>
        <Button onClick={submitClaim} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Claim'}
        </Button>
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {currentStep === 'form' && 'Submit New Claim'}
            {currentStep === 'validation' && 'Claim Validation'}
            {currentStep === 'review' && 'Review Claim'}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 border border-red-200 bg-red-50 rounded-md p-3">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="text-sm text-red-700 mt-1">{error}</div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'form' && renderFormStep()}
          {currentStep === 'validation' && renderValidationStep()}
          {currentStep === 'review' && renderReviewStep()}
        </CardContent>
      </Card>
    </div>
  );
}