'use client'

import { useEffect, useState } from 'react'
import { Building2, Save, Image as ImageIcon } from 'lucide-react'
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
            <CardDescription>Basic company information</CardDescription>
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
          </CardContent>
        </Card>

        {/* Payslip Footer */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="text-base">Payslip Footer & Branding</CardTitle>
            <CardDescription>Customize payslip footer notes and signature assets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Signature Image URL</Label>
                <Input
                  value={profile.signatureImg || ''}
                  onChange={(e) => update('signatureImg', e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Stamp Image URL</Label>
                <Input
                  value={profile.stampImg || ''}
                  onChange={(e) => update('stampImg', e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Logo URL</Label>
              <Input
                value={profile.logo || ''}
                onChange={(e) => update('logo', e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <ImageIcon className="h-3 w-3" /> Image Hosting
              </div>
              <div className="text-muted-foreground">
                Provide public URLs for logo, signature, and stamp images. These appear on PDF payslips.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Live Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/20 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Salary Statement · كشف راتب</div>
                <div className="text-xl font-bold mt-1">{profile.name}</div>
                <div className="text-sm text-muted-foreground" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }}>{profile.nameAr}</div>
                <div className="text-xs text-muted-foreground mt-1">{profile.address} · VAT: {profile.vatNumber}</div>
              </div>
              {profile.logo && <img src={profile.logo} alt="Logo" className="h-12 w-12 rounded" />}
            </div>
            <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground">
              {profile.footerNote}
              <div className="mt-1" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }}>{profile.footerNoteAr}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, value, onChange, rtl }: { label: string; value: string; onChange: (v: string) => void; rtl?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
        dir={rtl ? 'rtl' : 'ltr'}
        style={rtl ? { fontFamily: 'var(--font-arabic)' } : undefined}
      />
    </div>
  )
}
