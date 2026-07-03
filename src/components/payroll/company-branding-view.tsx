'use client'

import { useEffect, useState, useRef } from 'react'
import { Building2, Save, Image as ImageIcon, Upload, X, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export function CompanyBrandingView() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const sigInputRef = useRef<HTMLInputElement>(null)
  const riderSigInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/company')
      .then(r => r.json())
      .then(d => setProfile(d?.profile))
      .finally(() => setLoading(false))
  }, [])

  const update = (key: string, value: any) => {
    setProfile((p: any) => ({ ...p, [key]: value }))
    setDirty(true)
  }

  // Convert uploaded file to base64 data URL
  const handleFileUpload = (file: File, field: 'logo' | 'signatureImg' | 'riderSignatureImg') => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image too large — max 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      update(field, e.target?.result as string)
      toast.success(`${field === 'logo' ? 'Logo' : field === 'signatureImg' ? 'Accounting Manager signature' : 'Driver signature'} uploaded`)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const resp = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (resp.ok) {
        toast.success('Company profile updated')
        setDirty(false)
      } else {
        toast.error('Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading || !profile) {
    return <div className="p-12 text-center text-muted-foreground">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Company Branding</h1>
          <p className="text-sm text-muted-foreground">
            Centralized company profile · feeds payslips, exports, and print layouts
          </p>
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? 'Saving...' : dirty ? 'Save Changes' : 'Saved'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Identity */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="text-base">Company Identity</CardTitle>
            <CardDescription>Basic company information shown on payslips</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Company Name (English)" value={profile.name} onChange={(v) => update('name', v)} />
            <Field label="Company Name (Arabic)" value={profile.nameAr} onChange={(v) => update('nameAr', v)} rtl />
            <Field label="Address" value={profile.address || ''} onChange={(v) => update('address', v)} />
            <Field label="Address (Arabic)" value={profile.addressAr || ''} onChange={(v) => update('addressAr', v)} rtl />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" value={profile.phone || ''} onChange={(v) => update('phone', v)} />
              <Field label="Email" value={profile.email || ''} onChange={(v) => update('email', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="VAT Number" value={profile.vatNumber || ''} onChange={(v) => update('vatNumber', v)} />
              <Field label="CR Number" value={profile.crNumber || ''} onChange={(v) => update('crNumber', v)} />
            </div>
            <Field label="Accounting Manager Name" value={profile.accManagerName || ''} onChange={(v) => update('accManagerName', v)} placeholder="e.g. Ahmed Al-Rashid" />
          </CardContent>
        </Card>

        {/* Logo & Signatures */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="text-base">Logo & Signatures</CardTitle>
            <CardDescription>Upload images — appear on PDF payslips</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <ImageUpload
              label="Company Logo"
              labelAr="شعار الشركة"
              value={profile.logo}
              onChange={(v) => update('logo', v)}
              inputRef={logoInputRef}
              onFileSelect={(f) => handleFileUpload(f, 'logo')}
              maxHeight={70}
            />

            {/* Accounting Manager Signature */}
            <ImageUpload
              label="Accounting Manager Signature"
              labelAr="توقيع مدير الحسابات"
              value={profile.signatureImg}
              onChange={(v) => update('signatureImg', v)}
              inputRef={sigInputRef}
              onFileSelect={(f) => handleFileUpload(f, 'signatureImg')}
              maxHeight={45}
            />

            {/* Driver Signature */}
            <ImageUpload
              label="Driver Signature (optional)"
              labelAr="توقيع السائق (اختياري)"
              value={profile.riderSignatureImg}
              onChange={(v) => update('riderSignatureImg', v)}
              inputRef={riderSigInputRef}
              onFileSelect={(f) => handleFileUpload(f, 'riderSignatureImg')}
              maxHeight={45}
            />

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <ImageIcon className="h-3 w-3" /> Image Guidelines
              </div>
              <div className="text-muted-foreground">
                · PNG or JPG · max 2MB · transparent background recommended for logo<br />
                · Signatures: use black ink on white background for best results
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payslip Footer */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-base">Payslip Footer Notes</CardTitle>
          <CardDescription>Custom text shown at the bottom of every payslip</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Footer Note (English)</Label>
            <Textarea
              value={profile.footerNote || ''}
              onChange={(e) => update('footerNote', e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Footer Note (Arabic)</Label>
            <Textarea
              value={profile.footerNoteAr || ''}
              onChange={(e) => update('footerNoteAr', e.target.value)}
              rows={2}
              className="mt-1"
              dir="rtl"
              style={{ fontFamily: 'var(--font-arabic)' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Live Payslip Preview
          </CardTitle>
          <CardDescription>This is how the header & footer of your payslips will appear</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/20 overflow-hidden">
            {/* Header preview */}
            <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', color: 'white', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '8px', letterSpacing: '2px', opacity: 0.7, textTransform: 'uppercase' }}>Salary Statement · كشف راتب</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>{profile.name}</div>
                <div style={{ fontSize: '12px', opacity: 0.9, fontFamily: 'var(--font-arabic)' }} dir="rtl">{profile.nameAr}</div>
                <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '4px' }}>{profile.address} · VAT: {profile.vatNumber}</div>
              </div>
              {profile.logo && (
                <img src={profile.logo} alt="Logo" style={{ maxHeight: '50px', maxWidth: '100px', objectFit: 'contain', background: 'white', padding: '4px', borderRadius: '4px' }} />
              )}
            </div>

            {/* Footer preview with two signatures */}
            <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '9px', color: '#6b7280', textAlign: 'center', marginBottom: '12px' }}>
                {profile.footerNote || 'This is a computer-generated payslip.'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  {profile.signatureImg ? (
                    <div style={{ height: '32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                      <img src={profile.signatureImg} alt="Acc Mgr" style={{ maxHeight: '30px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '32px', borderBottom: '1.5px solid #374151', marginBottom: '4px' }} />
                  )}
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#374151' }}>
                    {profile.accManagerName || 'Accounting Manager'}
                  </div>
                  <div style={{ fontSize: '9px', color: '#6b7280', fontFamily: 'var(--font-arabic)' }} dir="rtl">مدير الحسابات</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  {profile.riderSignatureImg ? (
                    <div style={{ height: '32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                      <img src={profile.riderSignatureImg} alt="Driver" style={{ maxHeight: '30px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '32px', borderBottom: '1.5px solid #374151', marginBottom: '4px' }} />
                  )}
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#374151' }}>Driver Signature</div>
                  <div style={{ fontSize: '9px', color: '#6b7280', fontFamily: 'var(--font-arabic)' }} dir="rtl">توقيع السائق</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, value, onChange, rtl, placeholder }: { label: string; value: string; onChange: (v: string) => void; rtl?: boolean; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1"
        dir={rtl ? 'rtl' : 'ltr'}
        style={rtl ? { fontFamily: 'var(--font-arabic)' } : undefined}
      />
    </div>
  )
}

function ImageUpload({ label, labelAr, value, onChange, inputRef, onFileSelect, maxHeight }: {
  label: string
  labelAr: string
  value: string | null
  onChange: (v: string | null) => void
  inputRef: React.RefObject<HTMLInputElement>
  onFileSelect: (file: File) => void
  maxHeight: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <Label className="text-xs">{label}</Label>
          <div className="text-[10px] text-muted-foreground" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }}>{labelAr}</div>
        </div>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-rose-500 text-xs"
            onClick={() => onChange(null)}
          >
            <X className="h-3 w-3 mr-1" /> Remove
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFileSelect(f)
          e.target.value = ''
        }}
      />
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
        {value ? (
          <div className="grid place-items-center bg-white rounded p-1" style={{ minHeight: `${maxHeight}px`, minWidth: '60px' }}>
            <img src={value} alt={label} style={{ maxHeight: `${maxHeight}px`, maxWidth: '120px', objectFit: 'contain' }} />
          </div>
        ) : (
          <div className="grid place-items-center bg-muted rounded" style={{ minHeight: `${maxHeight}px`, minWidth: '60px' }}>
            <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
          </div>
        )}
        <div className="flex-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-1" />
            {value ? 'Replace' : 'Upload'}
          </Button>
          <div className="text-[10px] text-muted-foreground mt-1">
            PNG or JPG · max 2MB
          </div>
        </div>
      </div>
    </div>
  )
}
