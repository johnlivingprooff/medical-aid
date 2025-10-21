import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Book, 
  Users, 
  FileText, 
  Shield, 
  CreditCard, 
  BarChart3, 
  Settings, 
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Help() {
  const navigate = useNavigate()

  const sections = [
    {
      id: 'overview',
      title: 'System Overview',
      icon: Book,
      description: 'Introduction to the Medical Aid Management System'
    },
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: CheckCircle,
      description: 'Quick start guide for new users'
    },
    {
      id: 'user-roles',
      title: 'User Roles & Permissions',
      icon: Shield,
      description: 'Understanding different user types and access levels'
    },
    {
      id: 'schemes',
      title: 'Managing Schemes',
      icon: CreditCard,
      description: 'Creating, editing, and managing medical aid schemes'
    },
    {
      id: 'members',
      title: 'Member Management',
      icon: Users,
      description: 'Adding and managing scheme members'
    },
    {
      id: 'claims',
      title: 'Claims Processing',
      icon: FileText,
      description: 'Submitting, reviewing, and processing claims'
    },
    {
      id: 'analytics',
      title: 'Analytics & Reports',
      icon: BarChart3,
      description: 'Understanding system reports and analytics'
    },
    {
      id: 'settings',
      title: 'System Settings',
      icon: Settings,
      description: 'Configuring system preferences and settings'
    }
  ]

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="container max-w-6xl py-6 mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Medical Aid Management System</h1>
            <p className="mt-2 text-lg text-muted-foreground">Complete User Manual & Documentation</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Table of Contents */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Book className="w-5 h-5" />
                Table of Contents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <nav className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="flex items-center w-full gap-2 p-2 text-sm text-left transition-colors rounded-md hover:bg-muted"
                  >
                    <section.icon className="w-4 h-4" />
                    {section.title}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-8 lg:col-span-3">
          
          {/* System Overview */}
          <section id="overview">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book className="w-5 h-5" />
                  System Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  The Medical Aid Management System is a comprehensive platform designed to manage medical aid schemes, 
                  process healthcare claims, and provide detailed analytics for healthcare administration.
                </p>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <h4 className="mb-2 font-semibold">Key Features</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• Scheme management and administration</li>
                      <li>• Member enrollment and management</li>
                      <li>• Claims submission and processing</li>
                      <li>• Provider network management</li>
                      <li>• Subscription tier management</li>
                      <li>• Real-time analytics and reporting</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="mb-2 font-semibold">System Benefits</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• Streamlined claim processing</li>
                      <li>• Automated benefit calculations</li>
                      <li>• Comprehensive audit trails</li>
                      <li>• Role-based access control</li>
                      <li>• Real-time data synchronization</li>
                      <li>• Mobile-responsive design</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Getting Started */}
          <section id="getting-started">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Getting Started
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="mb-3 font-semibold">1. First Login</h4>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Use your assigned credentials to log into the system. Contact your administrator if you haven't received login details.
                  </p>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Your role determines which features and data you can access.</span>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 font-semibold">2. Dashboard Navigation</h4>
                  <p className="mb-3 text-sm text-muted-foreground">
                    The dashboard provides an overview of key metrics and quick access to main functions:
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Claims:</strong> View and manage healthcare claims</li>
                    <li>• <strong>Members:</strong> Manage scheme members and enrollments</li>
                    <li>• <strong>Schemes:</strong> Configure and manage medical aid schemes</li>
                    <li>• <strong>Providers:</strong> Manage healthcare provider network</li>
                    <li>• <strong>Analytics:</strong> View reports and system insights</li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-3 font-semibold">3. Quick Actions</h4>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Button variant="outline" size="sm" onClick={() => navigate('/claims')}>
                      <FileText className="w-4 h-4 mr-2" />
                      View Claims
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('/members')}>
                      <Users className="w-4 h-4 mr-2" />
                      Manage Members
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('/schemes')}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      View Schemes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* User Roles */}
          <section id="user-roles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  User Roles & Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive">ADMIN</Badge>
                      <h4 className="font-semibold">System Administrator</h4>
                    </div>
                    <p className="mb-2 text-sm text-muted-foreground">Full system access with administrative privileges.</p>
                    <ul className="space-y-1 text-sm">
                      <li>• Create and manage all schemes</li>
                      <li>• Process and approve all claims</li>
                      <li>• Manage user accounts and permissions</li>
                      <li>• Access all analytics and reports</li>
                      <li>• Configure system settings</li>
                      <li>• Manage provider networks</li>
                    </ul>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="default">PROVIDER</Badge>
                      <h4 className="font-semibold">Healthcare Provider</h4>
                    </div>
                    <p className="mb-2 text-sm text-muted-foreground">Healthcare facilities and practitioners.</p>
                    <ul className="space-y-1 text-sm">
                      <li>• Submit claims for their patients</li>
                      <li>• View claim status and history</li>
                      <li>• Access patient information (with consent)</li>
                      <li>• Update provider profile information</li>
                      <li>• View their performance analytics</li>
                    </ul>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">PATIENT</Badge>
                      <h4 className="font-semibold">Scheme Member</h4>
                    </div>
                    <p className="mb-2 text-sm text-muted-foreground">Medical aid scheme members and their dependents.</p>
                    <ul className="space-y-1 text-sm">
                      <li>• View personal claims and history</li>
                      <li>• Check benefit balances and coverage</li>
                      <li>• Update personal information</li>
                      <li>• Download statements and certificates</li>
                      <li>• Manage subscription preferences</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Schemes Management */}
          <section id="schemes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Managing Schemes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="mb-3 font-semibold">Creating a New Scheme</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full bg-primary text-primary-foreground">1</div>
                      <div>
                        <p className="font-medium">Navigate to Schemes</p>
                        <p className="text-sm text-muted-foreground">Click on "Schemes" in the main navigation menu.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full bg-primary text-primary-foreground">2</div>
                      <div>
                        <p className="font-medium">Create New Scheme</p>
                        <p className="text-sm text-muted-foreground">Click the "Create Scheme" button to open the scheme creation modal.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full bg-primary text-primary-foreground">3</div>
                      <div>
                        <p className="font-medium">Configure Scheme Details</p>
                        <p className="text-sm text-muted-foreground">Enter scheme name, description, pricing, and benefit structure.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full bg-primary text-primary-foreground">4</div>
                      <div>
                        <p className="font-medium">Set Up Benefits</p>
                        <p className="text-sm text-muted-foreground">Define coverage amounts, deductibles, and benefit periods for each service type.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-3 font-semibold">Scheme Status Management</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-3 border rounded-lg">
                      <h5 className="mb-2 font-medium text-green-600">Active Schemes</h5>
                      <p className="text-sm text-muted-foreground">
                        Active schemes accept new members and process claims. All schemes are active by default.
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h5 className="mb-2 font-medium text-orange-600">Deactivation Options</h5>
                      <p className="text-sm text-muted-foreground">
                        Schemes can be deactivated (soft delete) or permanently deleted (cascade delete).
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <h5 className="font-medium text-amber-800 dark:text-amber-200">Deletion Warning</h5>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Deactivation preserves all data and allows reactivation. Cascade deletion permanently removes 
                          the scheme and all associated data (members, claims, etc.) and cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Member Management */}
          <section id="members">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Member Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="mb-3 font-semibold">Member Enrollment Process</h4>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Members can be enrolled individually or in bulk. Each member receives a unique Member ID.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <h5 className="mb-1 font-medium">Principal Members</h5>
                      <p className="text-sm text-muted-foreground">
                        Primary account holders who can enroll dependents and manage family coverage.
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h5 className="mb-1 font-medium">Dependents</h5>
                      <p className="text-sm text-muted-foreground">
                        Spouses, children, and other dependents covered under the principal member's scheme.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-3 font-semibold">Member Status Types</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">ACTIVE</Badge>
                      <span className="text-sm">Full coverage and benefits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">INACTIVE</Badge>
                      <span className="text-sm">Temporarily suspended</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">SUSPENDED</Badge>
                      <span className="text-sm">Coverage suspended due to non-payment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">TERMINATED</Badge>
                      <span className="text-sm">Membership ended</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Claims Processing */}
          <section id="claims">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Claims Processing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="mb-3 font-semibold">Claim Lifecycle</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">PENDING</Badge>
                      <span className="text-sm">Submitted and awaiting review</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="default">APPROVED</Badge>
                      <span className="text-sm">Approved for payment</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="destructive">REJECTED</Badge>
                      <span className="text-sm">Rejected with reason provided</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">PAID</Badge>
                      <span className="text-sm">Payment processed and completed</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-3 font-semibold">Claim Validation Rules</h4>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <h5 className="mb-1 font-medium">Eligibility Checks</h5>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• Member must be active and enrolled</li>
                        <li>• Service must be covered under scheme</li>
                        <li>• Waiting periods must be satisfied</li>
                        <li>• Pre-authorization required for certain services</li>
                      </ul>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <h5 className="mb-1 font-medium">Benefit Calculations</h5>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• Deductibles applied per benefit period</li>
                        <li>• Copayment percentages calculated</li>
                        <li>• Annual and lifetime limits enforced</li>
                        <li>• Network vs. out-of-network rates</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Analytics & Reports */}
          <section id="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Analytics & Reports
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="mb-3 font-semibold">Available Reports</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-3 border rounded-lg">
                      <h5 className="flex items-center gap-2 mb-1 font-medium">
                        <DollarSign className="w-4 h-4" />
                        Financial Reports
                      </h5>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• Claims paid by period</li>
                        <li>• Revenue and expense tracking</li>
                        <li>• Scheme utilization rates</li>
                        <li>• Cost per member analytics</li>
                      </ul>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <h5 className="flex items-center gap-2 mb-1 font-medium">
                        <Clock className="w-4 h-4" />
                        Operational Reports
                      </h5>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• Claim processing times</li>
                        <li>• Member enrollment trends</li>
                        <li>• Provider performance metrics</li>
                        <li>• System usage statistics</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-3 font-semibold">Dashboard Metrics</h4>
                  <p className="mb-3 text-sm text-muted-foreground">
                    The main dashboard provides real-time insights into system performance and key metrics.
                  </p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <h5 className="font-medium text-blue-700 dark:text-blue-300">Claims Overview</h5>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        Pending, approved, and rejected claims counts
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                      <h5 className="font-medium text-green-700 dark:text-green-300">Member Statistics</h5>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Active members, new enrollments, status distribution
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                      <h5 className="font-medium text-purple-700 dark:text-purple-300">Financial Health</h5>
                      <p className="text-sm text-purple-600 dark:text-purple-400">
                        Revenue, expenses, and utilization trends
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* System Settings */}
          <section id="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  System Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="mb-3 font-semibold">User Preferences</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h5 className="font-medium">Notifications</h5>
                        <p className="text-sm text-muted-foreground">Control email and in-app notifications</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                        Configure
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h5 className="font-medium">Display Preferences</h5>
                        <p className="text-sm text-muted-foreground">Theme, language, and timezone settings</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                        Configure
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-3 font-semibold">System Administration</h4>
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h5 className="font-medium text-red-800 dark:text-red-200">Administrator Access Required</h5>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          System-wide settings, user management, and security configurations are only available to system administrators.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Support & Contact */}
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  Support & Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <h5 className="mb-2 font-medium">Technical Support</h5>
                    <p className="mb-3 text-sm text-muted-foreground">
                      For system issues, bugs, or technical assistance.
                    </p>
                    <p className="text-sm">
                      <strong>Email:</strong> admin@eiteone.org<br />
                      <strong>Phone:</strong> +265-996-554-837
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h5 className="mb-2 font-medium">Administrator Support</h5>
                    <p className="mb-3 text-sm text-muted-foreground">
                      For user management, permissions, and system configuration.
                    </p>
                    <p className="text-sm">
                      <strong>Email:</strong> admin@eiteone.org<br />
                      <strong>Phone:</strong> +265-996-554-837
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <h5 className="mb-2 font-medium">Quick Tips</h5>
                  <ul className="space-y-1 text-sm">
                    <li>• Use the search bar in the header to quickly find members, claims, or providers</li>
                    <li>• Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">Ctrl+/</kbd> to focus the search bar from anywhere</li>
                    <li>• Most data tables can be filtered and sorted by clicking column headers</li>
                    <li>• Your role determines what actions and data you can access</li>
                    <li>• System automatically saves drafts of forms and remembers your preferences</li>
                    <li>• Use keyboard shortcuts: <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">Esc</kbd> to close modals and search results</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}