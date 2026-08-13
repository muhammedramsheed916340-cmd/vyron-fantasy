'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Menu,
  RefreshCw,
  Star,
  BookmarkCheck,
  Plus,
  List,
  HomeIcon,
  Clock,
  BarChart3,
  User,
  X,
  ChevronRight,
  Trophy,
  Youtube,
  Mail,
  Shield,
  FileText,
  AlertTriangle,
  Info,
  Lightbulb,
  HelpCircle,
  Users,
  ExternalLink,
  Zap,
  Share2,
  CheckCircle2,
  Globe,
  ChevronDown,
  ChevronUp,
  Loader2,
  Phone,
  LogIn,
  Crown,
  Flame,
  Bot,
  Ban,
  KeyRound,
  Lock,
  Unlock,
  Search,
  Trash2,
  Copy,
  PlusCircle,
  Settings,
  LayoutDashboard,
  FileKey,
  Activity,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { TGPlayer, GeneratedTeam, generateTeams, generateExtraTeams, autoSelectExtraPlayers, autoReplacePlayer, ExtraTeamGenInput, getRoleName, getRoleShort, PLAYER_ROLES, getLineupMode, getEligiblePlayers, isPlayerEligible, validateTeamForLineup, RoleCombination, CombinationMode, getAllValidCombinations, getCompatibleCombinations, autoSelectCombination, validateCombination, isCombinationCompatibleWithFixed, MIN_WK, MAX_WK, MIN_BAT, MAX_BAT, MIN_AR, MAX_AR, MIN_BOWL, MAX_BOWL, normalizePlatformName, resolvePlatformPlayerId, GenerationDebugInfo, GenerationResult, deduplicateAndValidateTeams, makeTeamSignature } from '@/lib/tg-api'
import JoinContestDialog from '@/components/join-contest/JoinContestDialog'
import FlashScreen from '@/components/FlashScreen'
import { JCMatch } from '@/lib/join-contest-service'

// Types
interface Match {
  _id: string
  id: string
  left_team_name: string
  right_team_name: string
  left_team_image: string
  right_team_image: string
  series_name: string
  match_time: string
  sport_index: number
  lineup_out: number
  automatic: boolean
  match_type: string
  fantasy_list: string[]
  categories: string[]
  createdAt: string
}

interface MatchDetail {
  _id: string
  id: string
  left_team_name: string
  right_team_name: string
  left_team_image: string
  right_team_image: string
  match_time: string
  match_type: string
  sport_index: number
  lineup_status: number
  toss: string
  left_team_players: TGPlayer[]
  right_team_players: TGPlayer[]
  fantasy_version: { name: string; version: number }[]
}

interface Promotion {
  _id: string
  label: string
  imageUrl: string
  notificationUrl: string
  urlType: number
  order: number
  active: boolean
}

interface UserProfile {
  name: string
  email: string
  picture: string
  mobile?: string
}

// Sport tabs configuration
const SPORTS = [
  { name: 'Cricket', icon: '🏏', key: 'cricket' },
  { name: 'Football', icon: '⚽', key: 'football' },
  { name: 'Basketball', icon: '🏀', key: 'basketball' },
  { name: 'Kabaddi', icon: '🤼', key: 'kabaddi' },
]

// Bottom navigation items
const BOTTOM_NAV = [
  { name: 'Home', icon: HomeIcon, active: true },
  { name: 'My matches', icon: Clock, active: false },
  { name: 'Research', icon: BarChart3, active: false },
  { name: 'User', icon: User, active: false },
]

// Sidebar navigation items
const SIDEBAR_ITEMS = [
  { name: 'How to generate?', icon: HelpCircle, type: 'modal' as const, modalKey: 'howto' },
  { name: 'Best tips', icon: Lightbulb, type: 'modal' as const, modalKey: 'tips' },
  { name: 'Privacy Policy', icon: Shield, type: 'modal' as const, modalKey: 'privacy' },
  { name: 'Terms And Conditions', icon: FileText, type: 'modal' as const, modalKey: 'terms' },
  { name: 'Disclaimer', icon: AlertTriangle, type: 'modal' as const, modalKey: 'disclaimer' },
  { name: 'contact us', icon: Mail, type: 'modal' as const, modalKey: 'contact' },
  { name: 'About VYRON', icon: Info, type: 'modal' as const, modalKey: 'about' },
]

// Team count options
const TEAM_COUNTS = [1, 2, 5, 10, 20, 40, 80, 100, 200, 400]

// Countdown timer component
function CountdownTimer({ matchTime }: { matchTime: string }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime()
      const matchDate = new Date(matchTime).getTime()
      const diff = matchDate - now

      if (diff <= 0) {
        setTimeLeft('Started')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
      }
    }

    calculateTime()
    const interval = setInterval(calculateTime, 1000)
    return () => clearInterval(interval)
  }, [matchTime])

  return <span className="font-medium text-sm text-foreground">{timeLeft}</span>
}

// Category badge component
function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    'Mega GL': 'bg-[#00bfa5] text-white hover:bg-[#00bfa5]',
    'SL': 'bg-[#ffc107] text-gray-900 hover:bg-[#ffc107]',
    'H2H': 'bg-[#f44336] text-white hover:bg-[#f44336]',
  }
  return (
    <Badge className={`${styles[category] || 'bg-gray-500 text-white'} text-[10px] px-1.5 py-0 font-semibold border-0 rounded`}>
      {category}
    </Badge>
  )
}

// Match card component
function MatchCard({ match, onSave, isSaved, onOpen }: { match: Match; onSave: (id: string) => void; isSaved: boolean; onOpen: (match: Match) => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => onOpen(match)}>
      {/* League name */}
      <div className="flex items-center gap-1.5 mb-3">
        <Star className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-600 font-medium">{match.series_name}</span>
      </div>

      {/* Teams row */}
      <div className="flex items-center justify-between mb-3">
        {/* Left team */}
        <div className="flex items-center gap-2 flex-1">
          <img
            src={match.left_team_image}
            alt={match.left_team_name}
            className="w-9 h-9 rounded-full object-cover bg-gray-100"
          />
          <span className="font-extrabold text-[15px]">{match.left_team_name}</span>
        </div>

        {/* Timer */}
        <div className="text-center px-2">
          <CountdownTimer matchTime={match.match_time} />
        </div>

        {/* Right team */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="font-extrabold text-[15px]">{match.right_team_name}</span>
          <img
            src={match.right_team_image}
            alt={match.right_team_name}
            className="w-9 h-9 rounded-full object-cover bg-gray-100"
          />
        </div>
      </div>

      {/* Footer: Categories + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {match.categories.map((cat) => (
            <CategoryBadge key={cat} category={cat} />
          ))}
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            className={`h-7 text-xs px-3 rounded ${isSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-[#2196f3] hover:bg-[#1e88e5]'}`}
            onClick={(e) => { e.stopPropagation(); onSave(match._id) }}
          >
            {isSaved ? (
              <><BookmarkCheck className="w-3.5 h-3.5 mr-0.5" /> Saved</>
            ) : (
              <><Plus className="w-3.5 h-3.5 mr-0.5" /> save</>
            )}
          </Button>
          <Button
            size="sm"
            className="h-7 w-7 p-0 bg-[#00D4AA] hover:bg-[#00B894] text-white rounded"
            onClick={(e) => { e.stopPropagation(); onOpen(match) }}
          >
            <List className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Player role color
function roleColor(role: number): string {
  switch (role) {
    case PLAYER_ROLES.WICKET_KEEPER: return 'bg-blue-100 text-blue-800 border-blue-200'
    case PLAYER_ROLES.BATSMAN: return 'bg-orange-100 text-orange-800 border-orange-200'
    case PLAYER_ROLES.ALL_ROUNDER: return 'bg-purple-100 text-purple-800 border-purple-200'
    case PLAYER_ROLES.BOWLER: return 'bg-green-100 text-green-800 border-green-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// Player Row Component
function PlayerRow({ player, isCaptain, isViceCaptain, teamName }: {
  player: TGPlayer
  isCaptain?: boolean
  isViceCaptain?: boolean
  teamName?: string
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 border-b border-gray-50 last:border-0 text-xs">
      <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
        <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-semibold truncate">{player.name}</span>
          {isCaptain && <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
          {isViceCaptain && <Crown className="w-3 h-3 text-gray-400 flex-shrink-0" />}
          {player.playing === 1 && <span className="text-[7px] bg-green-100 text-green-700 px-0.5 rounded font-bold">PLAYING</span>}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`text-[9px] px-1 py-0 rounded border ${roleColor(player.role)}`}>
            {getRoleShort(player.role)}
          </span>
          {teamName && <span className="text-[9px] text-gray-400">{teamName}</span>}
        </div>
      </div>
      <div className="text-right flex-shrink-0 w-8">
        <span className="font-medium">{player.credits}</span>
      </div>
      <div className="text-right flex-shrink-0 w-10">
        <span className="text-gray-500">{player.selected_by}%</span>
      </div>
    </div>
  )
}

// Generated Team Card
function GeneratedTeamCard({ team, leftTeamName, rightTeamName, teamIndex }: {
  team: GeneratedTeam
  leftTeamName: string
  rightTeamName: string
  teamIndex: number
}) {
  const [expanded, setExpanded] = useState(false)
  const leftPlayers = team.players.filter(p => p.team_name === leftTeamName)
  const rightPlayers = team.players.filter(p => p.team_name === rightTeamName)
  const totalCredits = team.players.reduce((sum, p) => sum + p.credits, 0)

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-2">
      {/* Header */}
      <div
        className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#6C63FF]">Team {teamIndex}</span>
          <Badge className="bg-[#00bfa5] text-white text-[9px] border-0 px-1.5">
            C: {team.captain.name}
          </Badge>
          <Badge className="bg-[#00D4AA] text-white text-[9px] border-0 px-1.5">
            VC: {team.viceCaptain.name}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">{totalCredits.toFixed(1)} cr</span>
          <span className="text-[10px] text-gray-500">{leftPlayers.length}-{rightPlayers.length}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Players by team */}
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="p-2">
              <p className="text-[10px] font-bold text-[#6C63FF] mb-1">{leftTeamName} ({leftPlayers.length})</p>
              {leftPlayers.map(p => (
                <PlayerRow
                  key={p.pl_id}
                  player={p}
                  isCaptain={p.pl_id === team.captain.pl_id}
                  isViceCaptain={p.pl_id === team.viceCaptain.pl_id}
                />
              ))}
            </div>
            <div className="p-2">
              <p className="text-[10px] font-bold text-[#00D4AA] mb-1">{rightTeamName} ({rightPlayers.length})</p>
              {rightPlayers.map(p => (
                <PlayerRow
                  key={p.pl_id}
                  player={p}
                  isCaptain={p.pl_id === team.captain.pl_id}
                  isViceCaptain={p.pl_id === team.viceCaptain.pl_id}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Modal content components
function HowToGenerateContent() {
  return (
    <div className="space-y-4 text-sm text-gray-700">
      <h3 className="text-lg font-bold text-[#6C63FF]">How to Generate Teams?</h3>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Select a match from the &quot;Upcoming Matches&quot; list on the home page.</li>
        <li>Click on the match card to open the team generation page.</li>
        <li>Choose the category: <strong>Mega GL</strong>, <strong>SL</strong>, or <strong>H2H</strong>.</li>
        <li>Select the number of teams you want to generate (1, 2, 5, 10, 20, 40, etc.).</li>
        <li>Click on <strong>&quot;Generate Teams&quot;</strong> button to create your fantasy teams.</li>
        <li>The software will automatically create optimized teams with Captain &amp; Vice-Captain.</li>
        <li>View each generated team with player details, credits, and selection %.</li>
        <li>Login to <strong>Dream11</strong> or <strong>My11Circle</strong> to transfer teams directly.</li>
      </ol>
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
        <p className="text-blue-800 font-medium">💡 Tip: Use Extra Generation mode for advanced team creation with fixed players and captain options!</p>
      </div>
    </div>
  )
}

function BestTipsContent() {
  return (
    <div className="space-y-4 text-sm text-gray-700">
      <h3 className="text-lg font-bold text-[#6C63FF]">Best Tips for Dream11</h3>
      <div className="space-y-3">
        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-800 mb-1">🎯 Captain & Vice Captain Selection</h4>
          <p>Always choose a top-order batsman or an all-rounder as Captain. Pick a consistent performer as Vice Captain.</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-1">⚖️ Team Balance</h4>
          <p>Maintain a balanced team with proper mix of batsmen, bowlers, and all-rounders. All-rounders give maximum points.</p>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
          <h4 className="font-semibold text-purple-800 mb-1">📊 Research & Analysis</h4>
          <p>Check player recent form, head-to-head records, pitch report, and weather conditions before creating teams.</p>
        </div>
        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
          <h4 className="font-semibold text-amber-800 mb-1">🏆 Grand League Strategy</h4>
          <p>Create multiple teams with different combinations. Use VYRON to generate optimized teams automatically.</p>
        </div>
        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
          <h4 className="font-semibold text-red-800 mb-1">⚡ Differential Picks</h4>
          <p>In Grand League, include 1-2 differential picks (low selection percentage players) who can give big points.</p>
        </div>
      </div>
    </div>
  )
}

function PrivacyPolicyContent() {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <h3 className="text-lg font-bold text-[#6C63FF]">Privacy Policy</h3>
      <p className="font-semibold">Last updated: January 2025</p>
      <p>VYRON (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the VYRON platform. This page informs you of our policies regarding the collection, use, and disclosure of personal information when you use our Service.</p>
      <h4 className="font-semibold text-gray-900">Information We Collect</h4>
      <p>We collect information that you provide directly to us, including:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Your Google account information when you sign in</li>
        <li>Match preferences and saved matches data</li>
        <li>Device information and usage statistics</li>
      </ul>
      <h4 className="font-semibold text-gray-900">How We Use Information</h4>
      <p>We use the information we collect to operate, maintain, and improve our Service, to communicate with you, and to provide customer support.</p>
      <h4 className="font-semibold text-gray-900">Data Security</h4>
      <p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.</p>
      <h4 className="font-semibold text-gray-900">Third-Party Services</h4>
      <p>We may use third-party services such as Google AdSense and Google Analytics that may collect information about your use of our Service.</p>
    </div>
  )
}

function TermsAndConditionsContent() {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <h3 className="text-lg font-bold text-[#6C63FF]">Terms And Conditions</h3>
      <p className="font-semibold">Last updated: January 2025</p>
      <p>By accessing and using VYRON software, you agree to be bound by these Terms and Conditions.</p>
      <h4 className="font-semibold text-gray-900">1. Acceptance of Terms</h4>
      <p>By using this service, you acknowledge that you have read and agree to these terms. If you do not agree, please do not use the service.</p>
      <h4 className="font-semibold text-gray-900">2. Service Description</h4>
      <p>VYRON is an AI-powered fantasy sports team generator that helps create optimized teams for platforms like Dream11. The software provides team suggestions based on algorithms and analysis.</p>
      <h4 className="font-semibold text-gray-900">3. Disclaimer</h4>
      <p>The teams generated by this software are suggestions only. We do not guarantee any winnings or results. Fantasy sports involve risk, and users should play responsibly.</p>
      <h4 className="font-semibold text-gray-900">4. User Responsibilities</h4>
      <p>Users are responsible for their own decisions and actions while using the generated teams. Users must comply with the terms of the respective fantasy sports platforms.</p>
      <h4 className="font-semibold text-gray-900">5. Intellectual Property</h4>
      <p>All content, software, and materials on this platform are owned by VYRON and are protected by intellectual property laws.</p>
    </div>
  )
}

function DisclaimerContent() {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <h3 className="text-lg font-bold text-[#6C63FF]">Disclaimer</h3>
      <p>The information provided by VYRON (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is for general informational purposes only.</p>
      <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
        <p className="text-amber-800 font-medium">⚠️ Important Disclaimer:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-amber-700">
          <li>VYRON is NOT affiliated with Dream11 or any other fantasy sports platform.</li>
          <li>The teams generated are suggestions only and do not guarantee any winnings.</li>
          <li>Fantasy sports involve financial risk. Play at your own risk and responsibility.</li>
          <li>We are not responsible for any financial losses incurred while using our suggestions.</li>
          <li>Users must be 18+ years old and comply with their local laws regarding fantasy sports.</li>
        </ul>
      </div>
      <p>Under no circumstance shall we have any liability to you for any loss or damage of any kind incurred as a result of the use of the site or reliance on any information provided on the site.</p>
    </div>
  )
}

function ContactUsContent() {
  return (
    <div className="space-y-4 text-sm text-gray-700">
      <h3 className="text-lg font-bold text-[#6C63FF]">VYRON Support</h3>
      <p>If you have any questions, suggestions, or need support, feel free to reach out to us:</p>
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
          <Mail className="w-5 h-5 text-[#6C63FF]" />
          <div>
            <p className="font-semibold text-gray-900">VYRON</p>
            <p className="text-gray-600">AI Fantasy Cricket Platform</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AboutUsContent() {
  return (
    <div className="space-y-4 text-sm text-gray-700">
      <h3 className="text-lg font-bold text-[#6C63FF]">About VYRON</h3>
      <div className="flex items-center gap-3 mb-4">
        <img src="/vyron_logo.svg" alt="VYRON" className="h-12" />
      </div>
      <p>VYRON is an advanced AI-powered Fantasy Cricket Team Generator that uses intelligent algorithms and data analysis to create optimized teams for Grand League (GL), Small League (SL), and Head-to-Head (H2H) contests.</p>
      <h4 className="font-semibold text-gray-900">What We Offer:</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>AI-optimized team generation for Cricket, Football, Basketball, and Kabaddi</li>
        <li>Multiple team creation for Grand League contests</li>
        <li>Direct transfer to Dream11 &amp; My11Circle</li>
        <li>Extra Generation with fixed players and captain options</li>
        <li>Auto and Manual mode for team customization</li>
      </ul>
      <div className="bg-[#6C63FF]/5 p-3 rounded-lg border border-[#6C63FF]/20">
        <p className="text-[#6C63FF] font-medium">AI-Powered Fantasy Cricket Team Generation</p>
      </div>
    </div>
  )
}

const MODAL_CONTENT: Record<string, () => React.ReactNode> = {
  howto: () => <HowToGenerateContent />,
  tips: () => <BestTipsContent />,
  privacy: () => <PrivacyPolicyContent />,
  terms: () => <TermsAndConditionsContent />,
  disclaimer: () => <DisclaimerContent />,
  contact: () => <ContactUsContent />,
  about: () => <AboutUsContent />,
}

// Main Page Component
export default function Home() {
  const [activeSport, setActiveSport] = useState('cricket')
  const [matches, setMatches] = useState<Match[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [savedMatches, setSavedMatches] = useState<Set<string>>(new Set())
  const [activeBottomNav, setActiveBottomNav] = useState('Home')
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTeamCount, setSelectedTeamCount] = useState<number>(20)
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null)
  const [matchDetailLoading, setMatchDetailLoading] = useState(false)
  const [generatedTeams, setGeneratedTeams] = useState<GeneratedTeam[]>([])
  const [generating, setGenerating] = useState(false)
  const [showPlayerList, setShowPlayerList] = useState(false)
  const [loginPlatform, setLoginPlatform] = useState<string | null>(null)
  const [mobileNumber, setMobileNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showJoinContestDialog, setShowJoinContestDialog] = useState(false)
  const [showFlashScreen, setShowFlashScreen] = useState(true)
  const [transferPlatform, setTransferPlatform] = useState<string | null>(null)
  const [transferOption, setTransferOption] = useState<'new' | 'existing' | 'replace'>('new')
  const [contestId, setContestId] = useState<string>('')
  const [transferring, setTransferring] = useState(false)
  const [transferProgress, setTransferProgress] = useState({ current: 0, total: 0, status: 'idle' as 'idle' | 'transferring' | 'done' | 'error' })

  // OTP state for Dream11
  const [otpState, setOtpState] = useState<string | null>(null)

  // Fantasy accounts stored per platform
  interface FantasyAccount {
    authToken: string
    mobileNumber: string
    my11circleChallenge?: string | null
    my11circleUserId?: string | null
    linkedAt: string
  }
  const [fantasyAccounts, setFantasyAccounts] = useState<Record<string, FantasyAccount | null>>({
    dream11: null,
    my11circle: null,
  })

  // Per-team transfer results
  interface TransferTeamResult {
    teamNumber: number
    status: 'pending' | 'processing' | 'success' | 'fail'
    message?: string
  }
  const [transferResults, setTransferResults] = useState<TransferTeamResult[]>([])
  const [transferSuccessCount, setTransferSuccessCount] = useState(0)
  const [transferFailCount, setTransferFailCount] = useState(0)

  // Existing teams on platform (for Replace mode)
  interface ExistingTeam {
    id: string | number
    name: string
    captain?: string
    players?: number
  }
  const [existingTeams, setExistingTeams] = useState<ExistingTeam[]>([])
  const [existingTeamsLoading, setExistingTeamsLoading] = useState(false)
  const [selectedReplaceIds, setSelectedReplaceIds] = useState<Set<string | number>>(new Set())

  // Extra Team Generation state
  const [genMode, setGenMode] = useState<'normal' | 'extra'>('normal')
  const [extraSubMode, setExtraSubMode] = useState<'manual' | 'auto'>('manual')
  const [extraFixedPlayers, setExtraFixedPlayers] = useState<TGPlayer[]>([])
  const [extraCaptainOptions, setExtraCaptainOptions] = useState<TGPlayer[]>([])
  const [extraViceCaptainOptions, setExtraViceCaptainOptions] = useState<TGPlayer[]>([])
  const [extraAvoidPlayers, setExtraAvoidPlayers] = useState<TGPlayer[]>([])
  const [extraPlayerPickerOpen, setExtraPlayerPickerOpen] = useState<'fix' | 'captain' | 'vicecaptain' | 'avoid' | null>(null)
  const [extraPlayerPickerSlot, setExtraPlayerPickerSlot] = useState<number>(0) // which slot is being picked
  const [extraAutoLastUpdated, setExtraAutoLastUpdated] = useState<string>('')

  // Combination Mode state
  const [combinationMode, setCombinationMode] = useState<CombinationMode>('auto')
  const [manualCombination, setManualCombination] = useState<RoleCombination>({ wk: 1, bat: 4, ar: 2, bowl: 4 })
  const [combinationErrors, setCombinationErrors] = useState<string[]>([])

  // Lineup-aware team validation state
  const [invalidTeams, setInvalidTeams] = useState<Map<number, { player: TGPlayer; reason: string }[]>>(new Map())

  // Generation context — tracks current settings to invalidate stale results
  const [generationContext, setGenerationContext] = useState<{
    mode: 'normal' | 'extra';
    category: string | null;
    combinationMode: CombinationMode;
    teamCount: number;
  }>({ mode: 'normal', category: null, combinationMode: 'auto', teamCount: 20 })

  // Generation debug info — displayed in UI
  const [generationDebug, setGenerationDebug] = useState<GenerationDebugInfo | null>(null)

  // Valid teams after lineup filtering — only these go to transfer/join
  const [validTeams, setValidTeams] = useState<GeneratedTeam[]>([])

  // Avoid players for normal mode
  const [normalAvoidPlayers, setNormalAvoidPlayers] = useState<TGPlayer[]>([])

  // Admin Panel - Hidden, accessed via 5-tap on header logo
  const [logoTapCount, setLogoTapCount] = useState(0)
  const [logoTapTimer, setLogoTapTimer] = useState<NodeJS.Timeout | null>(null)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoggingIn, setAdminLoggingIn] = useState(false)
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [adminView, setAdminView] = useState<'dashboard' | 'licenses' | 'users' | 'logs' | 'settings'>('dashboard')

  // Admin License Management
  const [adminLicenses, setAdminLicenses] = useState<any[]>([])
  const [adminLicenseLoading, setAdminLicenseLoading] = useState(false)
  const [adminLicenseType, setAdminLicenseType] = useState<string>('MONTHLY')
  const [adminLicenseCount, setAdminLicenseCount] = useState<number>(1)
  const [adminLicenseSearch, setAdminLicenseSearch] = useState('')
  const [adminTransferLogs, setAdminTransferLogs] = useState<any[]>([])

  // License state (kept for admin panel compatibility)
  const [userLicense, setUserLicense] = useState<{ valid: boolean; license?: { key: string; type: string; status: string; expiresAt: string | null; assignedTo: string | null } } | null>(null)

  const generatedTeamsRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Invalidate generated teams when generation context changes
  useEffect(() => {
    const current = { mode: genMode, category: selectedCategory, combinationMode, teamCount: selectedTeamCount };
    if (
      current.mode !== generationContext.mode ||
      current.category !== generationContext.category ||
      current.combinationMode !== generationContext.combinationMode ||
      current.teamCount !== generationContext.teamCount
    ) {
      // Context changed — invalidate previous results
      setGeneratedTeams([]);
      setInvalidTeams(new Map());
      setValidTeams([]);
      setGenerationDebug(null);
      setGenerationContext(current);
    }
  }, [genMode, selectedCategory, combinationMode, selectedTeamCount, generationContext])

  // Fetch matches
  const loadMatches = useCallback(async (sport: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/matches?sport=${sport}`)
      const data = await res.json()
      if (data.status === 'success') {
        setMatches(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch promotions
  const loadPromotions = useCallback(async () => {
    try {
      const res = await fetch('/api/promotions')
      const data = await res.json()
      if (data.status === 'success') {
        setPromotions(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch promotions:', err)
    }
  }, [])

  useEffect(() => {
    loadMatches(activeSport)
    loadPromotions()
  }, [activeSport, loadMatches, loadPromotions])

  // Auto-rotate carousel
  useEffect(() => {
    if (promotions.length <= 1) return
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % promotions.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [promotions.length])

  // Handle save match
  const handleSaveMatch = (matchId: string) => {
    setSavedMatches((prev) => {
      const next = new Set(prev)
      if (next.has(matchId)) {
        next.delete(matchId)
        toast({ title: 'Match removed from saved list' })
      } else {
        next.add(matchId)
        toast({ title: 'Match saved successfully!' })
      }
      return next
    })
  }

  // Validate user license - check server-side
  const validateUserLicense = useCallback(async () => {
    // Try to find an active license for any linked account
    const accounts = JSON.parse(localStorage.getItem('vyron_fantasy_accounts') || '{}')
    let accountId: string | null = null
    for (const platform of ['dream11', 'my11circle']) {
      if (accounts[platform]?.mobileNumber) {
        accountId = accounts[platform].mobileNumber
        break
      }
    }
    if (!accountId) {
      // Also check stored license key
      const storedKey = localStorage.getItem('vyron_license_key')
      if (storedKey) {
        try {
          const res = await fetch('/api/license/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: storedKey }),
          })
          const data = await res.json()
          if (data.status === 'success') {
            setUserLicense(data.data)
            return
          }
        } catch {}
      }
      setUserLicense({ valid: false })
      return
    }
    try {
      const res = await fetch('/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        setUserLicense(data.data)
        if (data.data.valid && data.data.license?.key) {
          localStorage.setItem('vyron_license_key', data.data.license.key)
        }
      }
    } catch {
      setUserLicense({ valid: false })
    }
  }, [])

  // Re-validate license when accounts change
  useEffect(() => {
    validateUserLicense()
  }, [validateUserLicense, fantasyAccounts])

  // Load admin data when admin dashboard opens
  useEffect(() => {
    if (activeModal === 'admin-dashboard' && adminToken) {
      fetch('/api/admin/licenses', { headers: { 'Authorization': `Bearer ${adminToken}` } })
        .then(res => res.json())
        .then(data => { if (data.status === 'success') setAdminLicenses(data.data) })
        .catch(() => {})
      fetch('/api/admin/transfer-logs', { headers: { 'Authorization': `Bearer ${adminToken}` } })
        .then(res => res.json())
        .then(data => { if (data.status === 'success') setAdminTransferLogs(data.data.logs) })
        .catch(() => {})
    }
  }, [activeModal, adminToken])

  // Handle 5-tap on header logo to open admin login
  const handleLogoTap = () => {
    const newCount = logoTapCount + 1
    setLogoTapCount(newCount)
    if (logoTapTimer) clearTimeout(logoTapTimer)
    if (newCount >= 5) {
      setLogoTapCount(0)
      setShowAdminLogin(true)
      return
    }
    const timer = setTimeout(() => setLogoTapCount(0), 2000)
    setLogoTapTimer(timer)
  }

  // Handle refresh
  const handleRefresh = () => {
    loadMatches(activeSport)
    loadPromotions()
    toast({ title: 'Data refreshed!' })
  }

  // Handle match card click - open match detail
  const handleOpenMatch = async (match: Match) => {
    setSelectedMatch(match)
    setSelectedCategory(match.categories[0] || null)
    setSelectedTeamCount(20)
    setGeneratedTeams([])
    setShowPlayerList(false)
    setMatchDetail(null)
    setMatchDetailLoading(true)
    setGenMode('normal')
    setExtraSubMode('manual')
    setExtraFixedPlayers([])
    setExtraCaptainOptions([])
    setExtraViceCaptainOptions([])
    setExtraAvoidPlayers([])
    setExtraAutoLastUpdated('')

    try {
      const res = await fetch(`/api/match-detail?matchId=${match.id}`)
      const data = await res.json()
      if (data.status === 'success') {
        setMatchDetail(data.data)
      } else {
        toast({ title: 'Failed to load match details', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Failed to load match details', variant: 'destructive' })
    } finally {
      setMatchDetailLoading(false)
    }
  }

  // Handle team generation
  const handleGenerateTeams = () => {
    if (!matchDetail || !selectedCategory) return

    const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
    const avoidIds = new Set(normalAvoidPlayers.map(p => p.pl_id))

    // Determine combination to use
    let activeCombination: RoleCombination | null = null
    if (combinationMode === 'manual') {
      // Validate manual combination
      const eligible = getEligiblePlayers(allPlayers, avoidIds)
      const validation = validateCombination(manualCombination, eligible, [])
      if (!validation.valid) {
        setCombinationErrors(validation.errors)
        toast({ title: `Invalid combination: ${validation.errors[0]}`, variant: 'destructive' })
        return
      }
      setCombinationErrors([])
      activeCombination = manualCombination
    } else {
      // Auto combination - will be determined per-team inside generateTeams via rotation
      // We pass null to let the existing category-based logic handle it,
      // but with lineup-aware filtering active
      activeCombination = null
    }

    setGenerating(true)
    setGeneratedTeams([])
    setInvalidTeams(new Map())
    setValidTeams([])
    setGenerationDebug(null)

    // Use a unique seed that differs from Extra generation
    const normalSeed = Date.now() + 1

    // Use setTimeout to show loading state
    setTimeout(() => {
      const result = generateTeams(
        matchDetail.left_team_players,
        matchDetail.right_team_players,
        selectedCategory,
        selectedTeamCount,
        normalSeed,
        avoidIds,
        activeCombination,
        combinationMode,
      )
      const rawTeams = result.teams
      const debug = result.debug

      // Deduplicate and validate teams against lineup
      const dedupResult = deduplicateAndValidateTeams(rawTeams, allPlayers, avoidIds)

      // Use ONLY valid teams for transfer/join — invalid teams are excluded
      setGeneratedTeams(dedupResult.valid)
      setValidTeams(dedupResult.valid)
      setGenerationDebug({
        ...debug,
        generatedTeams: rawTeams.length,
        duplicateRemoved: dedupResult.duplicateCount,
        invalidLineupRemoved: dedupResult.invalidLineupCount,
        validTeams: dedupResult.valid.length,
      })

      // Build invalid teams map for display
      const newInvalidTeams = new Map<number, { player: TGPlayer; reason: string }[]>()
      for (let i = 0; i < dedupResult.invalid.length; i++) {
        const team = dedupResult.invalid[i]
        const validation = validateTeamForLineup(team, allPlayers, avoidIds)
        if (!validation.valid) {
          newInvalidTeams.set(dedupResult.valid.length + i, validation.invalidPlayers)
        }
      }
      setInvalidTeams(newInvalidTeams)

      setGenerating(false)
      if (dedupResult.valid.length === 0) {
        const allP = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
        const lineupMode = getLineupMode(allP)
        const playingCount = allP.filter(p => p.playing === 1).length
        if (lineupMode === 'after' || playingCount > 0) {
          toast({ title: `0 valid teams. Lineup has ${playingCount} confirmed players. Try changing combination or removing avoid players.`, variant: 'destructive' })
        } else {
          toast({ title: '0 valid teams generated. Not enough valid player combinations. Try different category or combination.', variant: 'destructive' })
        }
      } else if (dedupResult.invalidLineupCount > 0 || dedupResult.duplicateCount > 0) {
        const msgs: string[] = []
        if (dedupResult.duplicateCount > 0) msgs.push(`${dedupResult.duplicateCount} duplicates removed`)
        if (dedupResult.invalidLineupCount > 0) msgs.push(`${dedupResult.invalidLineupCount} invalid after lineup check`)
        toast({ title: `${dedupResult.valid.length} valid teams (${msgs.join(', ')})` })
      } else {
        toast({ title: `${dedupResult.valid.length} teams generated successfully!` })
      }

      // Scroll to teams
      setTimeout(() => {
        generatedTeamsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }, 800)
  }

  // Handle Extra Team Generation
  const handleGenerateExtraTeams = () => {
    if (!matchDetail || !selectedCategory) return

    // Validation: exactly 8 fixed players
    if (extraFixedPlayers.length !== 8) {
      toast({ title: 'Select exactly 8 fixed players', variant: 'destructive' })
      return
    }

    // Validation: exactly 5 captain options
    if (extraCaptainOptions.length !== 5) {
      toast({ title: 'Select exactly 5 Captain options', variant: 'destructive' })
      return
    }

    // Validation: exactly 5 vice captain options
    if (extraViceCaptainOptions.length !== 5) {
      toast({ title: 'Select exactly 5 Vice Captain options', variant: 'destructive' })
      return
    }

    // Validation: C and VC can share players across the option lists,
    // but the generation algorithm ensures C ≠ VC in each team.
    // We just need at least one valid C/VC combo where C ≠ VC

    // Validate fixed players credits
    const fixedCredits = extraFixedPlayers.reduce((sum, p) => sum + p.credits, 0)
    if (fixedCredits > 100) {
      toast({ title: `Fixed players credits (${fixedCredits.toFixed(1)}) exceed 100`, variant: 'destructive' })
      return
    }

    // Validate team distribution of fixed players
    const leftTeamName = matchDetail.left_team_name
    const rightTeamName = matchDetail.right_team_name
    const fixedLeft = extraFixedPlayers.filter(p => p.team_name === leftTeamName).length
    const fixedRight = extraFixedPlayers.filter(p => p.team_name === rightTeamName).length
    if (fixedLeft > 7 || fixedRight > 7) {
      toast({ title: 'Fixed players exceed max 7 from one team', variant: 'destructive' })
      return
    }
    if (fixedLeft === 0 || fixedRight === 0) {
      toast({ title: 'Fixed players must include at least 1 from each team', variant: 'destructive' })
      return
    }

    // Validate at least one C/VC combo has both players in fixed+pool
    const allPlayerIds = new Set([
      ...matchDetail.left_team_players.map(p => p.pl_id),
      ...matchDetail.right_team_players.map(p => p.pl_id),
    ])
    const hasValidCombo = extraCaptainOptions.some(c =>
      allPlayerIds.has(c.pl_id) && extraViceCaptainOptions.some(vc =>
        vc.pl_id !== c.pl_id && allPlayerIds.has(vc.pl_id)
      )
    )
    if (!hasValidCombo) {
      toast({ title: 'No valid Captain/Vice Captain combination found', variant: 'destructive' })
      return
    }

    // Capture the requested count for validation after generation
    const requestedCount = selectedTeamCount
    const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
    const avoidIds = new Set(extraAvoidPlayers.map(p => p.pl_id))

    // Determine combination to use for extra generation
    let activeCombination: RoleCombination | null = null
    if (combinationMode === 'manual') {
      const eligible = getEligiblePlayers(allPlayers, avoidIds)
      const validation = validateCombination(manualCombination, eligible, extraFixedPlayers)
      if (!validation.valid) {
        setCombinationErrors(validation.errors)
        toast({ title: `Invalid combination: ${validation.errors[0]}`, variant: 'destructive' })
        return
      }
      setCombinationErrors([])
      activeCombination = manualCombination
    }

    setGenerating(true)
    setGeneratedTeams([])
    setInvalidTeams(new Map())
    setValidTeams([])
    setGenerationDebug(null)

    // Extra generation uses a different seed from Normal to ensure different teams
    const extraSeed = Date.now() + 99999

    setTimeout(() => {
      const result = generateExtraTeams({
        fixedPlayers: extraFixedPlayers,
        captainOptions: extraCaptainOptions,
        viceCaptainOptions: extraViceCaptainOptions,
        leftPlayers: matchDetail.left_team_players,
        rightPlayers: matchDetail.right_team_players,
        category: selectedCategory,
        count: requestedCount,
        seed: extraSeed,
        avoidPlayerIds: avoidIds,
        combination: activeCombination,
        combinationMode,
      })

      const rawTeams = result.teams
      const debug = result.debug

      // Deduplicate and validate teams against lineup
      const dedupResult = deduplicateAndValidateTeams(rawTeams, allPlayers, avoidIds)

      // Use ONLY valid teams for transfer/join
      setGeneratedTeams(dedupResult.valid)
      setValidTeams(dedupResult.valid)
      setGenerationDebug({
        ...debug,
        generatedTeams: rawTeams.length,
        duplicateRemoved: dedupResult.duplicateCount,
        invalidLineupRemoved: dedupResult.invalidLineupCount,
        validTeams: dedupResult.valid.length,
      })

      // Build invalid teams map for display
      const newInvalidTeams = new Map<number, { player: TGPlayer; reason: string }[]>()
      for (let i = 0; i < dedupResult.invalid.length; i++) {
        const team = dedupResult.invalid[i]
        const validation = validateTeamForLineup(team, allPlayers, avoidIds)
        if (!validation.valid) {
          newInvalidTeams.set(dedupResult.valid.length + i, validation.invalidPlayers)
        }
      }
      setInvalidTeams(newInvalidTeams)

      setGenerating(false)

      if (dedupResult.valid.length === 0) {
        toast({ title: 'Could not generate valid teams with these fixed players. Try different combinations.', variant: 'destructive' })
      } else if (dedupResult.valid.length < requestedCount) {
        const extra: string[] = []
        if (dedupResult.duplicateCount > 0) extra.push(`${dedupResult.duplicateCount} duplicates removed`)
        if (dedupResult.invalidLineupCount > 0) extra.push(`${dedupResult.invalidLineupCount} invalid lineup`)
        toast({ title: `${dedupResult.valid.length} of ${requestedCount} valid extra teams${extra.length > 0 ? ` (${extra.join(', ')})` : ''}`, variant: 'destructive' })
      } else {
        toast({ title: `${dedupResult.valid.length} extra teams generated!` })
      }

      setTimeout(() => {
        generatedTeamsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }, 800)
  }

  // Handle Auto Select for Extra Team Generation
  const handleAutoSelectExtra = useCallback(() => {
    if (!matchDetail) return

    const avoidIds = new Set(extraAvoidPlayers.map(p => p.pl_id))
    const result = autoSelectExtraPlayers(
      matchDetail.left_team_players,
      matchDetail.right_team_players,
      avoidIds,
    )

    setExtraFixedPlayers(result.fixedPlayers)
    setExtraCaptainOptions(result.captainOptions)
    setExtraViceCaptainOptions(result.viceCaptainOptions)
    setExtraAutoLastUpdated(new Date().toLocaleTimeString())
  }, [matchDetail, extraAvoidPlayers])

  // Handle removing a fix player with auto-replacement in auto mode
  const handleExtraRemoveFix = (slotIndex: number) => {
    const removed = extraFixedPlayers[slotIndex]
    if (!removed) return
    const newList = extraFixedPlayers.filter((_, i) => i !== slotIndex)

    if (extraSubMode === 'auto' && matchDetail) {
      const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
      const avoidIds = new Set(extraAvoidPlayers.map(p => p.pl_id))
      const currentIds = new Set(newList.map(p => p.pl_id))
      const eligible = allPlayers.filter(p =>
        !currentIds.has(p.pl_id) && !avoidIds.has(p.pl_id) && p.pl_id !== removed.pl_id
      )
      const sorted = eligible.sort((a, b) =>
        (b.selected_by * 0.35 + b.captain_percentage * 0.25 + b.points * 0.2 + (b.playing === 1 ? 10 : 0)) -
        (a.selected_by * 0.35 + a.captain_percentage * 0.25 + a.points * 0.2 + (a.playing === 1 ? 10 : 0))
      )
      const replacement = sorted[0]
      setExtraFixedPlayers(replacement ? [...newList, replacement] : newList)
      setExtraAutoLastUpdated(new Date().toLocaleTimeString())
    } else {
      setExtraFixedPlayers(newList)
    }
  }

  // Handle removing a captain with auto-replacement in auto mode
  const handleExtraRemoveC = (slotIndex: number) => {
    const removed = extraCaptainOptions[slotIndex]
    if (!removed) return
    const newList = extraCaptainOptions.filter((_, i) => i !== slotIndex)

    if (extraSubMode === 'auto' && matchDetail) {
      const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
      const avoidIds = new Set(extraAvoidPlayers.map(p => p.pl_id))
      const currentIds = new Set(newList.map(p => p.pl_id))
      const eligible = allPlayers.filter(p =>
        !currentIds.has(p.pl_id) && !avoidIds.has(p.pl_id)
      )
      const sorted = eligible.sort((a, b) =>
        (b.captain_percentage * 0.4 + b.selected_by * 0.3 + b.points * 0.2) -
        (a.captain_percentage * 0.4 + a.selected_by * 0.3 + a.points * 0.2)
      )
      const replacement = sorted[0]
      setExtraCaptainOptions(replacement ? [...newList, replacement] : newList)
      setExtraAutoLastUpdated(new Date().toLocaleTimeString())
    } else {
      setExtraCaptainOptions(newList)
    }
  }

  // Handle removing a VC with auto-replacement in auto mode
  const handleExtraRemoveVC = (slotIndex: number) => {
    const removed = extraViceCaptainOptions[slotIndex]
    if (!removed) return
    const newList = extraViceCaptainOptions.filter((_, i) => i !== slotIndex)

    if (extraSubMode === 'auto' && matchDetail) {
      const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
      const avoidIds = new Set(extraAvoidPlayers.map(p => p.pl_id))
      const currentIds = new Set(newList.map(p => p.pl_id))
      const eligible = allPlayers.filter(p =>
        !currentIds.has(p.pl_id) && !avoidIds.has(p.pl_id)
      )
      const sorted = eligible.sort((a, b) =>
        (b.vice_captain_percentage * 0.35 + b.selected_by * 0.3 + b.points * 0.2) -
        (a.vice_captain_percentage * 0.35 + a.selected_by * 0.3 + a.points * 0.2)
      )
      const replacement = sorted[0]
      setExtraViceCaptainOptions(replacement ? [...newList, replacement] : newList)
      setExtraAutoLastUpdated(new Date().toLocaleTimeString())
    } else {
      setExtraViceCaptainOptions(newList)
    }
  }

  // Lineup safety: auto-remove OUT players and replace in auto mode
  useEffect(() => {
    if (genMode !== 'extra' || extraSubMode !== 'auto' || !matchDetail) return

    const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
    const playerMap = new Map(allPlayers.map(p => [p.pl_id, p]))
    const hasConfirmed = allPlayers.some(p => p.playing === 1)

    let changed = false

    // Check fixed players for OUT
    for (const fp of extraFixedPlayers) {
      const current = playerMap.get(fp.pl_id)
      if (current && current.playing === 0 && hasConfirmed) {
        changed = true
        break
      }
    }
    // Check captain options for OUT
    if (!changed) {
      for (const c of extraCaptainOptions) {
        const current = playerMap.get(c.pl_id)
        if (current && current.playing === 0 && hasConfirmed) {
          changed = true
          break
        }
      }
    }
    // Check VC options for OUT
    if (!changed) {
      for (const vc of extraViceCaptainOptions) {
        const current = playerMap.get(vc.pl_id)
        if (current && current.playing === 0 && hasConfirmed) {
          changed = true
          break
        }
      }
    }

    if (changed) {
      const avoidIds = new Set(extraAvoidPlayers.map(p => p.pl_id))
      const result = autoSelectExtraPlayers(
        matchDetail.left_team_players,
        matchDetail.right_team_players,
        avoidIds,
      )
      setExtraFixedPlayers(result.fixedPlayers)
      setExtraCaptainOptions(result.captainOptions)
      setExtraViceCaptainOptions(result.viceCaptainOptions)
      setExtraAutoLastUpdated(new Date().toLocaleTimeString())
      toast({ title: 'Auto-updated: removed OUT players and replaced them' })
    }
  }, [matchDetail, genMode, extraSubMode])

  // Auto-trigger when switching to auto mode or when match data loads in auto mode
  useEffect(() => {
    if (genMode === 'extra' && extraSubMode === 'auto' && matchDetail) {
      handleAutoSelectExtra()
    }
  }, [genMode, extraSubMode, matchDetail, handleAutoSelectExtra])

  // Auto lineup detection & revalidation effect
  // When matchDetail updates (e.g., lineup becomes confirmed), revalidate all selected players
  useEffect(() => {
    if (!matchDetail) return

    const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
    const lineupMode = getLineupMode(allPlayers)

    if (lineupMode === 'after' && genMode === 'extra') {
      // AFTER LINEUP: Revalidate FIX, C, VC selections
      let needsRevalidation = false

      // Check fixed players
      for (const fp of extraFixedPlayers) {
        const check = isPlayerEligible(fp, allPlayers, new Set(extraAvoidPlayers.map(p => p.pl_id)))
        if (!check.eligible) {
          needsRevalidation = true
          break
        }
      }

      // Check captain options
      if (!needsRevalidation) {
        for (const c of extraCaptainOptions) {
          const check = isPlayerEligible(c, allPlayers, new Set(extraAvoidPlayers.map(p => p.pl_id)))
          if (!check.eligible) {
            needsRevalidation = true
            break
          }
        }
      }

      // Check VC options
      if (!needsRevalidation) {
        for (const vc of extraViceCaptainOptions) {
          const check = isPlayerEligible(vc, allPlayers, new Set(extraAvoidPlayers.map(p => p.pl_id)))
          if (!check.eligible) {
            needsRevalidation = true
            break
          }
        }
      }

      if (needsRevalidation) {
        if (extraSubMode === 'auto') {
          // Auto mode: auto-replace invalid players
          const avoidIds = new Set(extraAvoidPlayers.map(p => p.pl_id))
          const result = autoSelectExtraPlayers(
            matchDetail.left_team_players,
            matchDetail.right_team_players,
            avoidIds,
          )
          setExtraFixedPlayers(result.fixedPlayers)
          setExtraCaptainOptions(result.captainOptions)
          setExtraViceCaptainOptions(result.viceCaptainOptions)
          setExtraAutoLastUpdated(new Date().toLocaleTimeString())
          toast({ title: 'Lineup confirmed — auto-updated: removed OUT players' })
        } else {
          // Manual mode: mark invalid (the player picker will show OUT status)
          toast({ title: 'Lineup confirmed — some selected players are OUT. Please replace them.', variant: 'destructive' })
        }
      }

      // Also revalidate already generated teams
      if (generatedTeams.length > 0) {
        const avoidIds = new Set([
          ...normalAvoidPlayers.map(p => p.pl_id),
          ...extraAvoidPlayers.map(p => p.pl_id),
        ])
        // Re-deduplicate and validate
        const dedupResult = deduplicateAndValidateTeams(generatedTeams, allPlayers, avoidIds)
        setGeneratedTeams(dedupResult.valid)
        setValidTeams(dedupResult.valid)
        const newInvalidTeams = new Map<number, { player: TGPlayer; reason: string }[]>()
        for (let i = 0; i < dedupResult.invalid.length; i++) {
          const team = dedupResult.invalid[i]
          const validation = validateTeamForLineup(team, allPlayers, avoidIds)
          if (!validation.valid) {
            newInvalidTeams.set(dedupResult.valid.length + i, validation.invalidPlayers)
          }
        }
        setInvalidTeams(newInvalidTeams)
        if (newInvalidTeams.size > 0) {
          toast({ title: `${newInvalidTeams.size} previously generated team(s) are now INVALID after lineup update`, variant: 'destructive' })
        }
      }
    }
  }, [matchDetail, genMode, extraSubMode])

  // Handle OTP send
  const handleSendOTP = async () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      toast({ title: 'Please enter a valid 10-digit mobile number', variant: 'destructive' })
      return
    }

    setOtpVerifying(true)
    try {
      const res = await fetch('/api/fantasy/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fantasyApp: loginPlatform, mobileNumber })
      })
      const data = await res.json()
      if (data.status === 'success') {
        setOtpSent(true)
        // Store the state from send-otp response (needed for Dream11 verify)
        if (data.data?.state) {
          setOtpState(data.data.state)
        }
        toast({ title: 'OTP sent to +91 ' + mobileNumber })
      } else {
        toast({ title: data.message || 'Failed to send OTP. Please try again.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Failed to send OTP. Please check your connection.', variant: 'destructive' })
    } finally {
      setOtpVerifying(false)
    }
  }

  // Handle OTP verify
  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) {
      toast({ title: 'Please enter a valid OTP', variant: 'destructive' })
      return
    }

    setOtpVerifying(true)
    try {
      const payload: Record<string, unknown> = {
        fantasyApp: loginPlatform,
        mobileNumber,
        verificationCode: otp,
      }

      // Dream11 requires the state from send-otp
      if (loginPlatform === 'dream11' && otpState) {
        payload.state = otpState
      }

      const res = await fetch('/api/fantasy/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.status === 'success') {
        const token = data.data?.token
        const my11circleChallenge = data.data?.my11circleChallenge || null
        const my11circleUserId = data.data?.my11circleUserId || null

        if (token) {
          setAuthToken(token)
          localStorage.setItem('user_token', token)

          // Store the fantasy account
          const account: FantasyAccount = {
            authToken: token,
            mobileNumber,
            my11circleChallenge,
            my11circleUserId,
            linkedAt: new Date().toISOString(),
          }

          setFantasyAccounts(prev => {
            const updated = { ...prev, [loginPlatform!]: account }
            // Also save to localStorage for persistence
            localStorage.setItem('vyron_fantasy_accounts', JSON.stringify(updated))
            return updated
          })
        }

        setUserProfile(prev => ({
          ...prev,
          name: prev?.name || 'User',
          email: prev?.email || '',
          picture: prev?.picture || '',
          mobile: mobileNumber,
        }))
        setLoginPlatform(null)
        setShowLoginDialog(false)
        setOtpSent(false)
        setOtpState(null)
        setMobileNumber('')
        setOtp('')
        toast({ title: `Successfully linked ${loginPlatform} account!` })
      } else {
        toast({ title: data.message || 'Invalid OTP. Please try again.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Failed to verify OTP. Please try again.', variant: 'destructive' })
    } finally {
      setOtpVerifying(false)
    }
  }

  // Fetch existing teams from the platform for Replace mode
  const fetchExistingTeams = async () => {
    if (!transferPlatform || !selectedMatch?.id) return
    const account = fantasyAccounts[transferPlatform]
    if (!account?.authToken) return

    setExistingTeamsLoading(true)
    setExistingTeams([])
    setSelectedReplaceIds(new Set())

    try {
      const res = await fetch('/api/fantasy/list-of-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fantasyApp: transferPlatform,
          matchId: selectedMatch.id,
          authToken: account.authToken,
        }),
      })
      const data = await res.json()

      if (data.status === 'success' && data.data?.teamsList) {
        const teams: ExistingTeam[] = data.data.teamsList.map((t: Record<string, unknown>, idx: number) => ({
          id: (t.id as string | number) || (t._id as string | number) || idx + 1,
          name: (t.name as string) || `Team ${idx + 1}`,
          captain: (t.captain as string) || undefined,
          players: (t.players as number) || (t.player_count as number) || undefined,
        }))
        setExistingTeams(teams)
      } else {
        setExistingTeams([])
        toast({ title: data.message || 'Could not load existing teams', variant: 'destructive' })
      }
    } catch {
      setExistingTeams([])
      toast({ title: 'Failed to load existing teams', variant: 'destructive' })
    } finally {
      setExistingTeamsLoading(false)
    }
  }

  // Handle team transfer - real per-team API calls, no clipboard, no window.open
  // IMPORTANT: Only transfers validTeams (after lineup validation + deduplication)
  const handleTransfer = async () => {
    if (!transferPlatform || validTeams.length === 0) return

    const platformName = transferPlatform === 'dream11' ? 'Dream11' : 'My11Circle'
    const account = fantasyAccounts[transferPlatform]
    const total = validTeams.length

    // Check if user has authenticated with this platform
    if (!account?.authToken) {
      setTransferProgress({ current: 0, total: 0, status: 'error' })
      toast({
        title: `Please link your ${platformName} account first (OTP login)`,
        variant: 'destructive'
      })
      return
    }

    // For replace mode, validate that enough existing teams are selected
    if (transferOption === 'replace') {
      if (selectedReplaceIds.size === 0) {
        toast({ title: 'Select at least one existing team to replace', variant: 'destructive' })
        return
      }
    }

    // Pre-transfer: Verify the auth token is still valid by calling list-of-teams
    setTransferring(true)
    setTransferProgress({ current: 0, total, status: 'transferring' })
    setTransferResults([{ teamNumber: 0, status: 'processing' as const, message: 'Verifying account...' }])

    try {
      const verifyRes = await fetch('/api/fantasy/list-of-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fantasyApp: transferPlatform,
          matchId: selectedMatch?.id,
          authToken: account.authToken,
        }),
      })
      const verifyData = await verifyRes.json()

      if (verifyData.status !== 'success') {
        // Auth token is invalid/expired — clear it and prompt re-login
        setFantasyAccounts(prev => {
          const updated = { ...prev, [transferPlatform!]: null }
          localStorage.setItem('vyron_fantasy_accounts', JSON.stringify(updated))
          return updated
        })
        setTransferProgress({ current: 0, total: 0, status: 'error' })
        setTransferResults([])
        setTransferring(false)
        toast({
          title: `${platformName} account token expired. Please re-link via OTP.`,
          variant: 'destructive'
        })
        return
      }
    } catch {
      setTransferProgress({ current: 0, total: 0, status: 'error' })
      setTransferResults([])
      setTransferring(false)
      toast({
        title: 'Could not verify account. Please check your connection.',
        variant: 'destructive'
      })
      return
    }

    // Rate limiting delays between transfers (ms)
    const rateLimitMs: Record<string, number> = {
      dream11: 200,
      my11circle: 2000,
    }
    const delay = rateLimitMs[transferPlatform] || 500

    // Determine transfer type
    const transferType = transferOption === 'replace' ? 'edit' : 'new'

    // In replace mode, only process as many teams as we have selected to replace
    const teamsToProcess = transferOption === 'replace' ? Math.min(selectedReplaceIds.size, validTeams.length) : validTeams.length

    // Transfer safety: Validate all teams for lineup eligibility before transferring
    if (matchDetail) {
      const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
      const avoidIds = new Set([
        ...normalAvoidPlayers.map(p => p.pl_id),
        ...extraAvoidPlayers.map(p => p.pl_id),
      ])
      const invalidTeamIndices: number[] = []
      for (let i = 0; i < teamsToProcess; i++) {
        const team = validTeams[i]
        const validation = validateTeamForLineup(team, allPlayers, avoidIds)
        if (!validation.valid) {
          invalidTeamIndices.push(i)
        }
      }
      if (invalidTeamIndices.length > 0) {
        toast({
          title: `Cannot transfer: ${invalidTeamIndices.length} team(s) contain invalid players (OUT / NOT IN PLAYING XI)`,
          description: 'Regenerate teams after lineup confirmation to ensure all players are in Playing XI.',
          variant: 'destructive',
        })
        return
      }
    }

    // Initialize per-team results
    const initialResults: TransferTeamResult[] = Array.from({ length: teamsToProcess }, (_, idx) => ({
      teamNumber: idx + 1,
      status: 'pending' as const,
    }))
    setTransferResults(initialResults)
    setTransferSuccessCount(0)
    setTransferFailCount(0)
    setTransferProgress({ current: 0, total, status: 'transferring' })

    let successCount = 0
    let failCount = 0

    // Platform ID resolution uses resolvePlatformPlayerId from tg-api.ts
    // which handles case-insensitive matching (e.g., "Dream11" vs "dream11")

    // Helper: get available platform names from a player's fantasy_id_list (for debug)
    const getAvailablePlatforms = (player: TGPlayer): string[] => {
      if (!player.fantasy_id_list) return []
      return player.fantasy_id_list.map(f => f.name)
    }

    // Process teams sequentially with rate limiting
    for (let i = 0; i < teamsToProcess; i++) {
      const team = validTeams[i]

      // Mark this team as processing
      setTransferResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'processing' as const } : r
      ))
      setTransferProgress({ current: i + 1, total, status: 'transferring' })

      // Map players to platform-specific IDs
      const playerIds: number[] = []
      const failedMappings: string[] = []
      let allValid = true
      for (const player of team.players) {
        const platformId = resolvePlatformPlayerId(player, transferPlatform)
        if (platformId === null) {
          allValid = false
          const available = getAvailablePlatforms(player)
          failedMappings.push(`${player.name} (has: [${available.join(', ')}], needs: ${transferPlatform})`)
          break
        }
        playerIds.push(platformId)
      }

      const captainId = resolvePlatformPlayerId(team.captain, transferPlatform)
      const vicecaptainId = resolvePlatformPlayerId(team.viceCaptain, transferPlatform)

      if (captainId === null) {
        allValid = false
        const available = getAvailablePlatforms(team.captain)
        failedMappings.push(`C: ${team.captain.name} (has: [${available.join(', ')}], needs: ${transferPlatform})`)
      }
      if (vicecaptainId === null) {
        allValid = false
        const available = getAvailablePlatforms(team.viceCaptain)
        failedMappings.push(`VC: ${team.viceCaptain.name} (has: [${available.join(', ')}], needs: ${transferPlatform})`)
      }

      if (!allValid) {
        // Player mapping failed — include debug info about which player(s) failed
        failCount++
        setTransferFailCount(failCount)
        const detail = failedMappings.length > 0 ? failedMappings[0] : 'Unknown player'
        setTransferResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'fail' as const, message: `ID mapping failed: ${detail}` } : r
        ))
        continue
      }

      // Call the real transfer API for this team
      try {
        // Build the EXACT payload the TG API expects
        // Field names MUST match the original teamgeneration.in:
        //   matchId, captain, vice_captain, players, fantasyApp, authToken, sportIndex, type
        const payload: Record<string, unknown> = {
          matchId: selectedMatch?.id,
          captain: captainId,
          vice_captain: vicecaptainId,  // NOTE: underscore, not "vicecaptain"
          players: playerIds,             // NOTE: "players", not "playerList"
          fantasyApp: transferPlatform,
          authToken: account.authToken,
          sportIndex: selectedMatch?.sport_index ?? 0,  // 0=cricket
          type: transferType,
          licenseAccountId: (() => {
            const accts = JSON.parse(localStorage.getItem('vyron_fantasy_accounts') || '{}')
            for (const p of ['dream11', 'my11circle']) {
              if (accts[p]?.mobileNumber) return accts[p].mobileNumber
            }
            return null
          })(),
        }

        // For my11circle, include challenge token
        if (transferPlatform === 'my11circle' && account.my11circleChallenge) {
          payload.my11circleChallenge = account.my11circleChallenge
        }

        // Include joinContest flag if enabled — backend handles JWT token & contest joining
        if (contestId) {
          payload.joinContest = true
        }

        // For edit/replace mode, attach the existing team ID to replace
        if (transferType === 'edit') {
          // Map generated team index to the selected existing team to replace
          const replaceIdsArr = Array.from(selectedReplaceIds)
          if (i >= replaceIdsArr.length) {
            failCount++
            setTransferFailCount(failCount)
            setTransferResults(prev => prev.map((r, idx) =>
              idx === i ? { ...r, status: 'fail' as const, message: 'No existing team selected to replace' } : r
            ))
            continue
          }
          payload.id = replaceIdsArr[i]
        }

        const res = await fetch('/api/fantasy/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()

        if (data.status === 'success') {
          successCount++
          setTransferSuccessCount(successCount)
          setTransferResults(prev => prev.map((r, idx) =>
            idx === i ? {
              ...r,
              status: 'success' as const,
              message: data.contestJoined
                ? '✓ Team created & contest joined'
                : data.contestMessage
                  ? `✓ Team created (contest: ${data.contestMessage})`
                  : undefined,
            } : r
          ))
        } else {
          failCount++
          setTransferFailCount(failCount)
          setTransferResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'fail' as const, message: data.message || 'Transfer failed' } : r
          ))
        }
      } catch {
        failCount++
        setTransferFailCount(failCount)
        setTransferResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'fail' as const, message: 'Network error' } : r
        ))
      }

      // Rate limit: wait between team transfers (skip after last team)
      if (i < teamsToProcess - 1 && delay > 0) {
        await new Promise(r => setTimeout(r, delay))
      }
    }

    // Done
    setTransferProgress({ current: total, total, status: 'done' })
    setTransferring(false)

    if (failCount === 0) {
      toast({ title: `✓ All ${successCount} teams transferred to ${platformName}!` })
    } else if (successCount > 0) {
      toast({ title: `${successCount}/${total} teams transferred. ${failCount} failed.`, variant: 'destructive' })
    } else {
      toast({ title: `All ${failCount} team transfers failed.`, variant: 'destructive' })
    }
  }

  // Handle Google login - direct bypass for seamless experience
  const handleGoogleLogin = async () => {
    setOtpVerifying(true)
    try {
      // Try real Google auth via the TG API
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bypass: true })
      })
      const data = await res.json()

      if (data.status === 'success' && data.data) {
        const { token, user } = data.data
        setAuthToken(token)
        setUserProfile({
          name: user.name || 'VYRON User',
          email: user.email || 'user@vyron.app',
          picture: user.picture || '',
        })
        localStorage.setItem('user_token', token)
        localStorage.setItem('user_data', JSON.stringify(user))
        toast({ title: `Welcome, ${user.name || 'VYRON User'}!` })
      } else {
        // Fallback: set local auth directly
        const fakeToken = 'vyron_local_' + Date.now()
        const userData = { name: 'VYRON User', email: 'user@vyron.app', role: 'user' }
        setAuthToken(fakeToken)
        setUserProfile({
          name: 'VYRON User',
          email: 'user@vyron.app',
          picture: '',
        })
        localStorage.setItem('user_token', fakeToken)
        localStorage.setItem('user_data', JSON.stringify(userData))
        toast({ title: 'Welcome, VYRON User!' })
      }
    } catch {
      // Fallback: set local auth directly
      const fakeToken = 'vyron_local_' + Date.now()
      const userData = { name: 'VYRON User', email: 'user@vyron.app', role: 'user' }
      setAuthToken(fakeToken)
      setUserProfile({
        name: 'VYRON User',
        email: 'user@vyron.app',
        picture: '',
      })
      localStorage.setItem('user_token', fakeToken)
      localStorage.setItem('user_data', JSON.stringify(userData))
      toast({ title: 'Welcome, VYRON User!' })
    } finally {
      setOtpVerifying(false)
    }
  }

  // Load saved auth on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('user_token')
    const savedUser = localStorage.getItem('user_data')
    if (savedToken && savedUser) {
      try {
        const user = JSON.parse(savedUser)
        setAuthToken(savedToken)
        setUserProfile({
          name: user.name || 'User',
          email: user.email || '',
          picture: user.picture || '',
          mobile: user.mobileNumber || '',
        })
      } catch {
        localStorage.removeItem('user_token')
        localStorage.removeItem('user_data')
      }
    }
  }, [])

  // Load stored fantasy accounts on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('vyron_fantasy_accounts')
      if (stored) {
        const parsed = JSON.parse(stored)
        setFantasyAccounts(parsed)
      }
    } catch {}
  }, [])

  // Saved match objects
  const savedMatchList = matches.filter((m) => savedMatches.has(m._id))

  return (
    <>
      {/* ============ FLASH SCREEN ============ */}
      {showFlashScreen && (
        <FlashScreen onComplete={() => setShowFlashScreen(false)} />
      )}

    <div className="min-h-screen flex flex-col bg-[#f4f6f9]">
      {/* ============ TOP HEADER ============ */}
      <header className="bg-[#0f0f23] text-white flex items-center justify-between px-3 h-[56px] sticky top-0 z-50">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <button
          onClick={handleLogoTap}
          className="flex flex-col items-center bg-transparent border-0 p-0 cursor-pointer"
          aria-label="VYRON"
        >
          <div className="flex items-center gap-1.5">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-[15px]">VYRON</span>
          </div>
          <span className="text-[9px] opacity-80 -mt-0.5">AI Fantasy Cricket Platform</span>
        </button>

        <button
          onClick={handleRefresh}
          className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
          aria-label="Refresh data"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </header>

      {/* ============ SPORTS TABS ============ */}
      {(activeBottomNav === 'Home' || activeBottomNav === 'Research') && (
        <nav className="bg-white border-b border-gray-200 sticky top-[56px] z-40">
          <div className="flex">
            {SPORTS.map((sport) => (
              <button
                key={sport.key}
                onClick={() => setActiveSport(sport.key)}
                className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-colors relative ${
                  activeSport === sport.key
                    ? 'text-[#6C63FF] font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="text-lg mb-0.5">{sport.icon}</span>
                <span>{sport.name}</span>
                {activeSport === sport.key && (
                  <div className="absolute bottom-0 left-[20%] right-[20%] h-[3px] bg-[#6C63FF] rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* ============ MAIN CONTENT ============ */}
      <main className="flex-1 pb-16">

        {/* ======== HOME VIEW ======== */}
        {activeBottomNav === 'Home' && (
          <>
            {/* VYRON 3D Banner */}
            <div className="px-2.5 pt-2.5">
              <div className="relative rounded-xl overflow-hidden bg-[#0a0a1a] border border-white/5 shadow-lg shadow-[#6C63FF]/10">
                <img
                  src="/vyron_banner_3d.svg"
                  alt="VYRON — AI Fantasy Cricket Platform"
                  className="w-full h-auto"
                />
                {/* Subtle animated shimmer overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
              </div>
            </div>

            {/* Upcoming Matches Section */}
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-base font-semibold text-[#6C63FF]">Upcoming Matches</h2>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
                onClick={() => setActiveBottomNav('My matches')}
              >
                <BookmarkCheck className="w-3.5 h-3.5 mr-1" />
                Saved Matches
              </Button>
            </div>

            {/* Match Cards */}
            <div className="px-3 space-y-2.5">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-gray-200 rounded-full" />
                        <div className="h-4 bg-gray-200 rounded w-10" />
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-20" />
                      <div className="flex items-center gap-2">
                        <div className="h-4 bg-gray-200 rounded w-10" />
                        <div className="w-9 h-9 bg-gray-200 rounded-full" />
                      </div>
                    </div>
                    <div className="h-7 bg-gray-200 rounded w-full" />
                  </div>
                ))
              ) : matches.length > 0 ? (
                matches.map((match) => (
                  <MatchCard
                    key={match._id}
                    match={match}
                    onSave={handleSaveMatch}
                    isSaved={savedMatches.has(match._id)}
                    onOpen={handleOpenMatch}
                  />
                ))
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <p className="text-lg mb-1">No matches available</p>
                  <p className="text-sm">Check back later for upcoming {activeSport} matches</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ======== MY MATCHES VIEW ======== */}
        {activeBottomNav === 'My matches' && (
          <>
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-base font-semibold text-[#6C63FF]">My Saved Matches</h2>
              <span className="text-xs text-gray-500">{savedMatchList.length} match{savedMatchList.length !== 1 ? 'es' : ''}</span>
            </div>

            {savedMatchList.length > 0 ? (
              <div className="px-3 space-y-2.5">
                {savedMatchList.map((match) => (
                  <MatchCard
                    key={match._id}
                    match={match}
                    onSave={handleSaveMatch}
                    isSaved={true}
                    onOpen={handleOpenMatch}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <BookmarkCheck className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-lg font-semibold text-gray-700 mb-1">No saved matches</p>
                <p className="text-sm text-gray-500 mb-6 text-center">Save matches from the home page to see them here</p>
                <Button
                  className="bg-[#6C63FF] hover:bg-[#5B54E0] text-white"
                  onClick={() => setActiveBottomNav('Home')}
                >
                  <HomeIcon className="w-4 h-4 mr-2" />
                  Go to Home
                </Button>
              </div>
            )}
          </>
        )}

        {/* ======== RESEARCH VIEW ======== */}
        {activeBottomNav === 'Research' && (
          <>
            <div className="px-4 py-3">
              <h2 className="text-base font-semibold text-[#6C63FF]">Match Research</h2>
              <p className="text-xs text-gray-500 mt-0.5">Analyze lineups, fantasy platforms & more</p>
            </div>

            {loading ? (
              <div className="px-3 space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
                    <div className="h-20 bg-gray-200 rounded w-full mb-3" />
                    <div className="h-7 bg-gray-200 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : matches.length > 0 ? (
              <div className="px-3 space-y-2.5">
                {matches.map((match) => (
                  <div
                    key={match._id}
                    className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => handleOpenMatch(match)}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <Star className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-600 font-medium">{match.series_name}</span>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <img src={match.left_team_image} alt={match.left_team_name} className="w-8 h-8 rounded-full object-cover bg-gray-100" />
                        <span className="font-extrabold text-[14px]">{match.left_team_name}</span>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">VS</span>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[14px]">{match.right_team_name}</span>
                        <img src={match.right_team_image} alt={match.right_team_name} className="w-8 h-8 rounded-full object-cover bg-gray-100" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      {match.lineup_out === 1 ? (
                        <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Lineup Out
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                          <Clock className="w-3 h-3" /> Lineup Pending
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-[11px] text-gray-500">Platforms:</span>
                      <div className="flex gap-1 flex-wrap">
                        {match.fantasy_list.map((fp) => (
                          <span key={fp} className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-medium">{fp}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {match.categories.map((cat) => (
                        <CategoryBadge key={cat} category={cat} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <p className="text-lg mb-1">No matches for research</p>
                <p className="text-sm">Check back later for {activeSport} matches</p>
              </div>
            )}
          </>
        )}

        {/* ======== USER VIEW ======== */}
        {activeBottomNav === 'User' && (
          <div className="px-4 pt-4">
            {/* Profile card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
              {userProfile ? (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#7c6bb5] flex items-center justify-center text-white text-2xl font-bold shadow-md overflow-hidden">
                      {userProfile.picture ? (
                        <img src={userProfile.picture} alt={userProfile.name} className="w-full h-full object-cover" />
                      ) : (
                        userProfile.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-lg text-gray-900">{userProfile.name}</p>
                      {userProfile.email && <p className="text-sm text-gray-500">{userProfile.email}</p>}
                      {userProfile.mobile && <p className="text-sm text-gray-500">📱 {userProfile.mobile}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 mb-2">
                    <BookmarkCheck className="w-5 h-5 text-[#6C63FF]" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{savedMatchList.length} Saved Match{savedMatchList.length !== 1 ? 'es' : ''}</p>
                      <p className="text-xs text-gray-500">Across all sports</p>
                    </div>
                  </div>
                  {/* Fantasy Platform Linking */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-2">LINK FANTASY PLATFORMS</p>
                    <div className="space-y-2">
                      <Button
                        className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white h-10 text-sm font-semibold"
                        onClick={() => { setLoginPlatform('dream11'); setShowLoginDialog(true) }}
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Link Dream11
                      </Button>
                      <Button
                        className="w-full bg-[#2196f3] hover:bg-[#1e88e5] text-white h-10 text-sm font-semibold"
                        onClick={() => { setLoginPlatform('my11circle'); setShowLoginDialog(true) }}
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Link My11Circle
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-3 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { setUserProfile(null); setAuthToken(null); localStorage.removeItem('user_token'); localStorage.removeItem('user_data'); toast({ title: 'Logged out successfully' }) }}
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#7c6bb5] flex items-center justify-center text-white text-2xl font-bold shadow-md">
                      ?
                    </div>
                    <div>
                      <p className="font-bold text-lg text-gray-900">Not Logged In</p>
                      <p className="text-sm text-gray-500">Login to access all features</p>
                    </div>
                  </div>

                  {/* Login Buttons */}
                  <div className="space-y-2.5">
                    {/* Google Login (Optional) */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-1">
                      <p className="text-xs text-blue-800 font-semibold">Sign in with Google (optional)</p>
                      <p className="text-[10px] text-blue-700">For enhanced features & team transfer</p>
                    </div>
                    <Button
                      className="w-full bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 h-11 text-sm font-semibold"
                      onClick={handleGoogleLogin}
                    >
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.19 3.32v2.77h3.54c2.08-1.92 3.29-4.75 3.29-8.1z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.77c-.98.66-2.23 1.06-3.74 1.06-2.88 0-5.32-1.94-6.2-4.55H2.18v2.86C4 20.15 7.76 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.8 14.08A6.95 6.95 0 0 1 5.44 12c0-.72.13-1.42.36-2.08V7.06H2.18A11.01 11.01 0 0 0 1 12c0 1.8.43 3.49 1.18 4.98l3.62-2.9z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.76 1 4 3.87 2.18 7.06l3.62 2.86c.88-2.61 3.32-4.54 6.2-4.54z"/>
                      </svg>
                      Sign in with Google
                    </Button>

                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[10px] text-gray-400 font-medium">OR LINK PLATFORM</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* Dream11 Login */}
                    <Button
                      className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white h-11 text-sm font-semibold"
                      onClick={() => { setLoginPlatform('dream11'); setShowLoginDialog(true) }}
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Link Dream11
                    </Button>

                    {/* My11Circle Login */}
                    <Button
                      className="w-full bg-[#2196f3] hover:bg-[#1e88e5] text-white h-11 text-sm font-semibold"
                      onClick={() => { setLoginPlatform('my11circle'); setShowLoginDialog(true) }}
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Link My11Circle
                    </Button>

                    {!authToken && (
                      <p className="text-[10px] text-gray-400 text-center">Enter your mobile number to link via OTP</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Links */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              <button
                onClick={() => setActiveModal('about')}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
              >
                <Info className="w-5 h-5 text-[#6C63FF]" />
                <span className="flex-1">About Us</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setActiveModal('contact')}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
              >
                <Mail className="w-5 h-5 text-[#6C63FF]" />
                <span className="flex-1">Contact Us</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setActiveModal('privacy')}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
              >
                <Shield className="w-5 h-5 text-[#6C63FF]" />
                <span className="flex-1">Privacy Policy</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setActiveModal('terms')}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
              >
                <FileText className="w-5 h-5 text-[#6C63FF]" />
                <span className="flex-1">Terms & Conditions</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setActiveModal('disclaimer')}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
              >
                <AlertTriangle className="w-5 h-5 text-[#6C63FF]" />
                <span className="flex-1">Disclaimer</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

            </div>

            {/* VYRON Logo & Version info */}
            <div className="flex flex-col items-center py-6">
              <img src="/vyron_logo_dark.svg" alt="VYRON" className="h-12 mb-3" />
              <p className="text-xs text-gray-400 font-medium">VYRON v1.0.0</p>
              <p className="text-[10px] text-gray-400">© 2025 VYRON. All rights reserved.</p>
            </div>
          </div>
        )}
      </main>

      {/* ============ BOTTOM NAVIGATION ============ */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon
            const isActive = activeBottomNav === item.name
            return (
              <button
                key={item.name}
                onClick={() => setActiveBottomNav(item.name)}
                className={`flex-1 flex flex-col items-center py-2 text-[11px] relative transition-colors ${
                  isActive ? 'text-[#6C63FF] font-semibold' : 'text-gray-500'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span>{item.name}</span>
                {isActive && (
                  <div className="absolute top-0 left-[20%] right-[20%] h-[3px] bg-[#6C63FF] rounded-b-full" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ============ SIDEBAR ============ */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 bg-[#0f0f23] text-white border-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 h-[56px] border-b border-white/20">
              <img src="/vyron_logo_dark.svg" alt="VYRON" className="h-10" />
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-white/10 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              <ul className="space-y-0.5">
                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.name}>
                      <button
                        onClick={() => {
                          setSidebarOpen(false)
                          if (item.type === 'link') {
                            window.open(item.url, '_blank')
                          } else if (item.type === 'modal' && item.modalKey) {
                            setTimeout(() => setActiveModal(item.modalKey!), 200)
                          }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 transition-colors text-left"
                      >
                        <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                        <span>{item.name}</span>
                        {item.type === 'link' && <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-60" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="border-t border-white/20 p-4">
              <p className="text-xs opacity-70 mb-2">developed by</p>
              <div className="flex items-center gap-2 mb-2">
                <img src="/vyron_logo_dark.svg" alt="VYRON" className="h-8" />
              </div>
              <div>
                <p className="text-xs opacity-70">All Rights Reserved</p>
                <p className="text-xs opacity-70">©2025 VYRON</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ============ MATCH DETAIL DIALOG (Full Team Generation) ============ */}
      <Dialog open={selectedMatch !== null} onOpenChange={(open) => { if (!open) { setSelectedMatch(null); setMatchDetail(null); setGeneratedTeams([]) } }}>
        <DialogContent className="max-w-[96vw] max-h-[90vh] overflow-y-auto p-0 rounded-xl">
          <DialogTitle className="sr-only">Match Detail - VYRON</DialogTitle>
          {selectedMatch && (
            <div className="p-4">
              {/* Close button */}
              <button
                onClick={() => { setSelectedMatch(null); setMatchDetail(null); setGeneratedTeams([]) }}
                className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 rounded-md z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Series name */}
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="w-4 h-4 text-[#6C63FF]" />
                <span className="text-sm text-gray-600 font-medium">{selectedMatch.series_name}</span>
              </div>

              {/* Team info */}
              <div className="flex items-center justify-between mb-3 bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 flex-1">
                  <img src={selectedMatch.left_team_image} alt={selectedMatch.left_team_name} className="w-10 h-10 rounded-full object-cover bg-gray-200" />
                  <span className="font-extrabold text-[15px]">{selectedMatch.left_team_name}</span>
                </div>
                <span className="text-xs font-bold text-[#6C63FF] px-2">VS</span>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="font-extrabold text-[15px]">{selectedMatch.right_team_name}</span>
                  <img src={selectedMatch.right_team_image} alt={selectedMatch.right_team_name} className="w-10 h-10 rounded-full object-cover bg-gray-200" />
                </div>
              </div>

              {/* Countdown Timer */}
              <div className="flex items-center justify-center gap-2 mb-3 bg-[#6C63FF]/5 rounded-lg p-2.5">
                <Clock className="w-4 h-4 text-[#6C63FF]" />
                <span className="text-xs text-gray-600 font-medium">Starts in:</span>
                <CountdownTimer matchTime={selectedMatch.match_time} />
              </div>

              {/* Lineup Status */}
              <div className="mb-3">
                {matchDetail ? (
                  (() => {
                    const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
                    const lineupMode = getLineupMode(allPlayers)
                    const isAfterLineup = lineupMode === 'after'
                    const playingCount = allPlayers.filter(p => p.playing === 1).length
                    const totalCount = allPlayers.length

                    return isAfterLineup ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-700 font-bold">AFTER LINEUP — PLAYING XI CONFIRMED</span>
                        </div>
                        <p className="text-xs text-green-600 mt-1 ml-6">{playingCount} of {totalCount} players confirmed playing. Only Playing XI players will be used for team generation.</p>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span className="text-sm text-amber-700 font-bold">BEFORE LINEUP</span>
                        </div>
                        <p className="text-xs text-amber-600 mt-1 ml-6">Lineup not yet confirmed. All players are eligible. Teams may need regeneration after lineup is out.</p>
                      </div>
                    )
                  })()
                ) : (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    <span className="text-sm text-gray-500">Loading match details...</span>
                  </div>
                )}
              </div>

              {/* Toss info */}
              {matchDetail && matchDetail.toss && matchDetail.toss !== 'NA' && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-3">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-700 font-medium">Toss: {matchDetail.toss}</span>
                </div>
              )}

              {/* Loading state for player data */}
              {matchDetailLoading && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-[#6C63FF] animate-spin mb-3" />
                  <p className="text-sm text-gray-600">Loading player data...</p>
                </div>
              )}

              {/* Player Data Loaded */}
              {matchDetail && !matchDetailLoading && (
                <>
                  {/* Player List Toggle */}
                  <button
                    onClick={() => setShowPlayerList(!showPlayerList)}
                    className="w-full flex items-center justify-between mb-3 bg-white border border-gray-200 rounded-lg p-2.5 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#6C63FF]" />
                      <span className="text-sm font-semibold text-gray-700">
                        Players ({matchDetail.left_team_players.length + matchDetail.right_team_players.length})
                      </span>
                    </div>
                    {showPlayerList ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>

                  {/* Player List */}
                  {showPlayerList && (
                    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 text-[10px] font-semibold text-gray-500 border-b border-gray-200">
                        <div className="w-7" />
                        <div className="flex-1">Player</div>
                        <div className="w-8 text-right">Cr</div>
                        <div className="w-10 text-right">Sel%</div>
                      </div>
                      {/* Left team players */}
                      <div className="border-b border-gray-200">
                        <div className="px-2 py-1 bg-[#6C63FF]/5 text-[10px] font-bold text-[#6C63FF]">
                          {matchDetail.left_team_name} ({matchDetail.left_team_players.length})
                        </div>
                        {matchDetail.left_team_players.map(p => (
                          <PlayerRow key={p.pl_id} player={p} />
                        ))}
                      </div>
                      {/* Right team players */}
                      <div>
                        <div className="px-2 py-1 bg-[#00D4AA]/5 text-[10px] font-bold text-[#00D4AA]">
                          {matchDetail.right_team_name} ({matchDetail.right_team_players.length})
                        </div>
                        {matchDetail.right_team_players.map(p => (
                          <PlayerRow key={p.pl_id} player={p} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generation Mode Toggle */}
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Generation Mode</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setGenMode('normal'); setGeneratedTeams([]) }}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border-2 ${
                          genMode === 'normal'
                            ? 'bg-[#6C63FF] text-white border-[#6C63FF] shadow-md'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Zap className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                        Normal Generation
                      </button>
                      <button
                        onClick={() => { setGenMode('extra'); setGeneratedTeams([]) }}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border-2 ${
                          genMode === 'extra'
                            ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <Flame className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                        Extra Generation
                      </button>
                    </div>
                  </div>

                  {/* Category Selection (common for both modes) */}
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">1. Select Category</p>
                    <div className="flex gap-2">
                      {selectedMatch.categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => { setSelectedCategory(cat); setGeneratedTeams([]) }}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border-2 ${
                            selectedCategory === cat
                              ? cat === 'Mega GL'
                                ? 'bg-[#00bfa5] text-white border-[#00bfa5] shadow-md'
                                : cat === 'SL'
                                ? 'bg-[#ffc107] text-gray-900 border-[#ffc107] shadow-md'
                                : 'bg-[#f44336] text-white border-[#f44336] shadow-md'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Combination Mode */}
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Combination</p>
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => setCombinationMode('manual')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${
                          combinationMode === 'manual'
                            ? 'bg-[#6C63FF] text-white border-[#6C63FF] shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#6C63FF]/40 hover:text-[#6C63FF]'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" /> MANUAL
                      </button>
                      <button
                        onClick={() => { setCombinationMode('auto'); setCombinationErrors([]) }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${
                          combinationMode === 'auto'
                            ? 'bg-[#6C63FF] text-white border-[#6C63FF] shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#6C63FF]/40 hover:text-[#6C63FF]'
                        }`}
                      >
                        <Bot className="w-3.5 h-3.5" /> AUTO
                      </button>
                    </div>

                    {combinationMode === 'manual' && matchDetail && (
                      <div className="space-y-2">
                        <div className="bg-[#6C63FF]/5 border border-[#6C63FF]/20 rounded-lg p-2.5">
                          <p className="text-[11px] font-semibold text-[#6C63FF] mb-2">Manual Combination — Select role distribution</p>
                          <div className="grid grid-cols-4 gap-2">
                            {/* WK */}
                            <div className="text-center">
                              <p className="text-[10px] font-bold text-blue-600 mb-1">WK</p>
                              <select
                                value={manualCombination.wk}
                                onChange={(e) => {
                                  const newCombo = { ...manualCombination, wk: parseInt(e.target.value) }
                                  setManualCombination(newCombo)
                                }}
                                className="w-full text-center text-sm font-semibold bg-white border border-gray-200 rounded-md py-1 px-1 focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                              >
                                {Array.from({ length: MAX_WK - MIN_WK + 1 }, (_, i) => MIN_WK + i).map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                            {/* BAT */}
                            <div className="text-center">
                              <p className="text-[10px] font-bold text-orange-600 mb-1">BAT</p>
                              <select
                                value={manualCombination.bat}
                                onChange={(e) => {
                                  const newCombo = { ...manualCombination, bat: parseInt(e.target.value) }
                                  setManualCombination(newCombo)
                                }}
                                className="w-full text-center text-sm font-semibold bg-white border border-gray-200 rounded-md py-1 px-1 focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                              >
                                {Array.from({ length: MAX_BAT - MIN_BAT + 1 }, (_, i) => MIN_BAT + i).map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                            {/* AR */}
                            <div className="text-center">
                              <p className="text-[10px] font-bold text-purple-600 mb-1">AR</p>
                              <select
                                value={manualCombination.ar}
                                onChange={(e) => {
                                  const newCombo = { ...manualCombination, ar: parseInt(e.target.value) }
                                  setManualCombination(newCombo)
                                }}
                                className="w-full text-center text-sm font-semibold bg-white border border-gray-200 rounded-md py-1 px-1 focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                              >
                                {Array.from({ length: MAX_AR - MIN_AR + 1 }, (_, i) => MIN_AR + i).map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                            {/* BOWL */}
                            <div className="text-center">
                              <p className="text-[10px] font-bold text-green-600 mb-1">BOWL</p>
                              <select
                                value={manualCombination.bowl}
                                onChange={(e) => {
                                  const newCombo = { ...manualCombination, bowl: parseInt(e.target.value) }
                                  setManualCombination(newCombo)
                                }}
                                className="w-full text-center text-sm font-semibold bg-white border border-gray-200 rounded-md py-1 px-1 focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                              >
                                {Array.from({ length: MAX_BOWL - MIN_BOWL + 1 }, (_, i) => MIN_BOWL + i).map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="mt-2 text-center">
                            <p className={`text-xs font-semibold ${
                              manualCombination.wk + manualCombination.bat + manualCombination.ar + manualCombination.bowl === 11
                                ? 'text-green-600' : 'text-red-500'
                            }`}>
                              Total: {manualCombination.wk + manualCombination.bat + manualCombination.ar + manualCombination.bowl}/11
                            </p>
                          </div>
                        </div>
                        {combinationErrors.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                            {combinationErrors.map((err, i) => (
                              <p key={i} className="text-[10px] text-red-600">{err}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {combinationMode === 'auto' && (
                      <div className="bg-[#6C63FF]/5 border border-[#6C63FF]/20 rounded-lg p-2.5 flex items-start gap-2">
                        <Bot className="w-4 h-4 text-[#6C63FF] flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-semibold text-[#6C63FF]">Auto Combination Active</p>
                          <p className="text-[10px] text-[#6C63FF]/70">Combinations will be intelligently selected and rotated based on category, player pool, and match conditions.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ====== NORMAL TEAM GENERATION MODE ====== */}
                  {genMode === 'normal' && (
                    <>
                      {/* Team Count Selection */}
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">2. Number of Teams</p>
                        <div className="flex flex-wrap gap-1.5">
                          {TEAM_COUNTS.map((count) => (
                            <button
                              key={count}
                              onClick={() => { setSelectedTeamCount(count); setGeneratedTeams([]) }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                selectedTeamCount === count
                                  ? 'bg-[#6C63FF] text-white border-[#6C63FF] shadow-sm'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#6C63FF]/30 hover:text-[#6C63FF]'
                              }`}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Generate Teams Button */}
                      <Button
                        className="w-full bg-[#6C63FF] hover:bg-[#5B54E0] text-white h-12 text-sm font-semibold mb-3"
                        disabled={!selectedCategory || generating}
                        onClick={handleGenerateTeams}
                      >
                        {generating ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating {selectedTeamCount} teams...</>
                        ) : (
                          <><Zap className="w-4 h-4 mr-2" /> Generate {selectedTeamCount} Teams {selectedCategory ? `(${selectedCategory})` : ''}</>
                        )}
                      </Button>
                    </>
                  )}

                  {/* ====== EXTRA TEAM GENERATION MODE ====== */}
                  {genMode === 'extra' && (
                    <>
                      {/* Manual / Auto Sub-Mode Toggle */}
                      <div className="mb-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setExtraSubMode('manual')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${
                              extraSubMode === 'manual'
                                ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 hover:text-orange-600'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" /> MANUAL
                          </button>
                          <button
                            onClick={() => setExtraSubMode('auto')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${
                              extraSubMode === 'auto'
                                ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 hover:text-orange-600'
                            }`}
                          >
                            <Bot className="w-3.5 h-3.5" /> AUTO
                          </button>
                        </div>
                      </div>

                      {/* Auto Mode Info Banner */}
                      {extraSubMode === 'auto' && (
                        <div className="mb-3 bg-orange-50 border border-orange-200 rounded-lg p-2.5 flex items-start gap-2">
                          <Bot className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-semibold text-orange-700">Auto Mode Active</p>
                            <p className="text-[10px] text-orange-600">Players are auto-selected based on points &amp; credits. You can still manually adjust selections. Removing a player in auto mode will auto-fill the slot with the next best player.</p>
                          </div>
                        </div>
                      )}

                      {/* 8 Fix Players */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-700">
                            2. Fix Players
                            <span className={`ml-1.5 text-xs font-normal ${extraFixedPlayers.length === 8 ? 'text-green-600' : 'text-amber-600'}`}>
                              ({extraFixedPlayers.length}/8)
                            </span>
                          </p>
                          {extraFixedPlayers.length > 0 && (
                            <button
                              onClick={() => setExtraFixedPlayers([])}
                              className="text-[10px] text-red-500 hover:underline"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {Array.from({ length: 8 }).map((_, slot) => {
                            const player = extraFixedPlayers[slot]
                            return (
                              <button
                                key={slot}
                                onClick={() => {
                                  setExtraPlayerPickerOpen('fix')
                                  setExtraPlayerPickerSlot(slot)
                                }}
                                className={`relative rounded-lg border-2 p-1.5 text-left transition-all min-h-[56px] ${
                                  player
                                    ? (matchDetail && !isPlayerEligible(player, [...matchDetail.left_team_players, ...matchDetail.right_team_players], new Set(extraAvoidPlayers.map(p => p.pl_id))).eligible)
                                      ? 'border-red-500 bg-red-50'
                                      : 'border-[#6C63FF] bg-[#6C63FF]/5'
                                    : 'border-dashed border-gray-300 bg-white hover:border-[#6C63FF]/40'
                                }`}
                              >
                                {player ? (
                                  <div className="flex items-center gap-1">
                                    <img src={player.image} alt={player.name} className="w-5 h-5 rounded-full object-cover bg-gray-100 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-[9px] font-semibold truncate leading-tight">{player.name}</p>
                                      {matchDetail && !isPlayerEligible(player, [...matchDetail.left_team_players, ...matchDetail.right_team_players], new Set(extraAvoidPlayers.map(p => p.pl_id))).eligible ? (
                                        <p className="text-[7px] font-bold text-red-500 leading-tight">OUT</p>
                                      ) : (
                                        <p className={`text-[8px] px-0.5 rounded leading-tight ${roleColor(player.role)}`}>{getRoleShort(player.role)}</p>
                                      )}
                                    </div>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleExtraRemoveFix(slot) } }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleExtraRemoveFix(slot)
                                      }}
                                      className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center cursor-pointer"
                                    >
                                      ×
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full">
                                    <Plus className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-[8px] text-gray-400 mt-0.5">P{slot + 1}</span>
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        {extraFixedPlayers.length < 8 && (
                          <p className="text-[10px] text-amber-600 mt-1">Select {8 - extraFixedPlayers.length} more player{8 - extraFixedPlayers.length > 1 ? 's' : ''}</p>
                        )}
                        {extraFixedPlayers.length === 8 && (
                          <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 8 fixed players selected</p>
                        )}
                      </div>

                      {/* 5 Captain Options */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-700">
                            3. Captain (C) Options
                            <span className={`ml-1.5 text-xs font-normal ${extraCaptainOptions.length === 5 ? 'text-green-600' : 'text-amber-600'}`}>
                              ({extraCaptainOptions.length}/5)
                            </span>
                          </p>
                          {extraCaptainOptions.length > 0 && (
                            <button
                              onClick={() => setExtraCaptainOptions([])}
                              className="text-[10px] text-red-500 hover:underline"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {Array.from({ length: 5 }).map((_, slot) => {
                            const player = extraCaptainOptions[slot]
                            return (
                              <button
                                key={slot}
                                onClick={() => {
                                  setExtraPlayerPickerOpen('captain')
                                  setExtraPlayerPickerSlot(slot)
                                }}
                                className={`relative rounded-lg border-2 p-1.5 text-left transition-all min-h-[56px] ${
                                  player
                                    ? 'border-yellow-500 bg-yellow-50'
                                    : 'border-dashed border-gray-300 bg-white hover:border-yellow-400'
                                }`}
                              >
                                {player ? (
                                  <div className="flex items-center gap-1">
                                    <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-[9px] font-semibold truncate leading-tight">{player.name}</p>
                                      <p className={`text-[8px] px-0.5 rounded leading-tight ${roleColor(player.role)}`}>{getRoleShort(player.role)}</p>
                                    </div>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleExtraRemoveC(slot) } }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleExtraRemoveC(slot)
                                      }}
                                      className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center cursor-pointer"
                                    >
                                      ×
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full">
                                    <Crown className="w-3.5 h-3.5 text-yellow-400" />
                                    <span className="text-[8px] text-gray-400 mt-0.5">C{slot + 1}</span>
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* 5 Vice Captain Options */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-700">
                            4. Vice Captain (VC) Options
                            <span className={`ml-1.5 text-xs font-normal ${extraViceCaptainOptions.length === 5 ? 'text-green-600' : 'text-amber-600'}`}>
                              ({extraViceCaptainOptions.length}/5)
                            </span>
                          </p>
                          {extraViceCaptainOptions.length > 0 && (
                            <button
                              onClick={() => setExtraViceCaptainOptions([])}
                              className="text-[10px] text-red-500 hover:underline"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {Array.from({ length: 5 }).map((_, slot) => {
                            const player = extraViceCaptainOptions[slot]
                            return (
                              <button
                                key={slot}
                                onClick={() => {
                                  setExtraPlayerPickerOpen('vicecaptain')
                                  setExtraPlayerPickerSlot(slot)
                                }}
                                className={`relative rounded-lg border-2 p-1.5 text-left transition-all min-h-[56px] ${
                                  player
                                    ? 'border-gray-400 bg-gray-50'
                                    : 'border-dashed border-gray-300 bg-white hover:border-gray-400'
                                }`}
                              >
                                {player ? (
                                  <div className="flex items-center gap-1">
                                    <Crown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-[9px] font-semibold truncate leading-tight">{player.name}</p>
                                      <p className={`text-[8px] px-0.5 rounded leading-tight ${roleColor(player.role)}`}>{getRoleShort(player.role)}</p>
                                    </div>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleExtraRemoveVC(slot) } }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleExtraRemoveVC(slot)
                                      }}
                                      className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center cursor-pointer"
                                    >
                                      ×
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full">
                                    <Crown className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-[8px] text-gray-400 mt-0.5">VC{slot + 1}</span>
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Avoid / Exclude Players */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <Ban className="w-3.5 h-3.5 text-red-500" />
                            5. Avoid / Exclude Players
                            {extraAvoidPlayers.length > 0 && (
                              <span className="text-xs font-normal text-red-500">({extraAvoidPlayers.length})</span>
                            )}
                          </p>
                        </div>
                        {extraAvoidPlayers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {extraAvoidPlayers.map((player) => (
                              <div
                                key={player.pl_id}
                                className="relative flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1"
                              >
                                <img src={player.image} alt={player.name} className="w-4 h-4 rounded-full object-cover bg-gray-100 flex-shrink-0" />
                                <span className="text-[9px] font-medium text-red-700 max-w-[60px] truncate">{player.name}</span>
                                <button
                                  onClick={() => setExtraAvoidPlayers(prev => prev.filter(p => p.pl_id !== player.pl_id))}
                                  className="w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center flex-shrink-0"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => setExtraPlayerPickerOpen('avoid')}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 hover:text-red-700 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add player to avoid
                        </button>
                      </div>

                      {/* Auto Update Button & Last Updated (auto mode only) */}
                      {extraSubMode === 'auto' && (
                        <div className="mb-3 space-y-2">
                          <button
                            onClick={handleAutoSelectExtra}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 transition-all"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Auto Update Selections
                          </button>
                          {extraAutoLastUpdated && (
                            <p className="text-[10px] text-gray-500 text-center">
                              Last updated: {extraAutoLastUpdated}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Extra: Team Count Selection */}
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-gray-700 mb-2">6. Number of Teams</p>
                        <div className="flex flex-wrap gap-1.5">
                          {TEAM_COUNTS.map((count) => (
                            <button
                              key={count}
                              onClick={() => { setSelectedTeamCount(count); setGeneratedTeams([]) }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                selectedTeamCount === count
                                  ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 hover:text-orange-600'
                              }`}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Validation Summary */}
                      <div className="mb-3 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-[10px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Fixed Players</span>
                          <span className={extraFixedPlayers.length === 8 ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                            {extraFixedPlayers.length}/8 {extraFixedPlayers.length === 8 ? '✓' : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Captain Options</span>
                          <span className={extraCaptainOptions.length === 5 ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                            {extraCaptainOptions.length}/5 {extraCaptainOptions.length === 5 ? '✓' : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Vice Captain Options</span>
                          <span className={extraViceCaptainOptions.length === 5 ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                            {extraViceCaptainOptions.length}/5 {extraViceCaptainOptions.length === 5 ? '✓' : ''}
                          </span>
                        </div>
                        {extraAvoidPlayers.length > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Avoided Players</span>
                            <span className="text-red-500 font-semibold">{extraAvoidPlayers.length}</span>
                          </div>
                        )}
                        {extraFixedPlayers.length > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Fixed Credits</span>
                            <span className={extraFixedPlayers.reduce((s, p) => s + p.credits, 0) <= 100 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                              {extraFixedPlayers.reduce((s, p) => s + p.credits, 0).toFixed(1)}/100
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Combination</span>
                          <span className="text-[#6C63FF] font-semibold">
                            {combinationMode === 'manual'
                              ? `WK${manualCombination.wk} BAT${manualCombination.bat} AR${manualCombination.ar} BOWL${manualCombination.bowl}`
                              : 'AUTO'
                            }
                          </span>
                        </div>
                        {matchDetail && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Lineup</span>
                            <span className={getLineupMode([...matchDetail.left_team_players, ...matchDetail.right_team_players]) === 'after' ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                              {getLineupMode([...matchDetail.left_team_players, ...matchDetail.right_team_players]) === 'after' ? 'AFTER LINEUP' : 'BEFORE LINEUP'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Generate Extra Teams Button */}
                      <Button
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 text-sm font-semibold mb-3"
                        disabled={!selectedCategory || generating || extraFixedPlayers.length !== 8 || extraCaptainOptions.length !== 5 || extraViceCaptainOptions.length !== 5}
                        onClick={handleGenerateExtraTeams}
                      >
                        {generating ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating {selectedTeamCount} extra teams...</>
                        ) : (
                          <><Flame className="w-4 h-4 mr-2" /> Generate {selectedTeamCount} Extra Teams {selectedCategory ? `(${selectedCategory})` : ''}</>
                        )}
                      </Button>
                    </>
                  )}

                  {/* Generated Teams Display */}
                  {generatedTeams.length > 0 && (
                    <div ref={generatedTeamsRef} className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-gray-700">
                          Generated Teams ({validTeams.length} valid{generationDebug && generationDebug.generatedTeams !== validTeams.length ? ` / ${generationDebug.generatedTeams} raw` : ''})
                          {invalidTeams.size > 0 && (
                            <span className="ml-2 text-xs text-red-500 font-normal">
                              ({invalidTeams.size} invalid after lineup check)
                            </span>
                          )}
                          {generationDebug && generationDebug.duplicateRemoved > 0 && (
                            <span className="ml-2 text-xs text-amber-500 font-normal">
                              ({generationDebug.duplicateRemoved} duplicates removed)
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Crown className="w-3 h-3 text-yellow-500" /> = Captain
                          <Crown className="w-3 h-3 text-gray-400 ml-1" /> = Vice Captain
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto space-y-0">
                        {generatedTeams.map((team, idx) => {
                          const isInvalid = invalidTeams.has(idx)
                          const invalidPlayers = invalidTeams.get(idx)
                          return (
                            <div key={team.id} className={isInvalid ? 'opacity-60' : ''}>
                              <GeneratedTeamCard
                                team={team}
                                leftTeamName={matchDetail.left_team_name}
                                rightTeamName={matchDetail.right_team_name}
                                teamIndex={idx + 1}
                              />
                              {isInvalid && invalidPlayers && (
                                <div className="bg-red-50 border border-red-200 rounded-b-lg p-1.5 -mt-1">
                                  <p className="text-[9px] font-bold text-red-600 mb-0.5">
                                    <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
                                    INVALID AFTER LINEUP
                                  </p>
                                  {invalidPlayers.map((ip, i) => (
                                    <p key={i} className="text-[8px] text-red-500 ml-4">
                                      {ip.player.name} — {ip.reason}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Generation Debug Info */}
                  {generationDebug && (
                    <div className="mb-3 bg-gray-50 border border-gray-200 rounded-lg p-2">
                      <p className="text-[10px] font-bold text-gray-500 mb-1">GENERATION DEBUG</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-gray-600">
                        <span>Mode: <b>{generationDebug.generationMode}</b></span>
                        <span>Category: <b>{generationDebug.category}</b></span>
                        <span>Combination: <b>{generationDebug.combinationMode}</b></span>
                        <span>Strategy: <b className="text-[#6C63FF]">{generationDebug.strategyUsed}</b></span>
                        <span>Requested: <b>{generationDebug.requestedTeams}</b></span>
                        <span>Generated: <b>{generationDebug.generatedTeams}</b></span>
                        <span>Duplicates Removed: <b className="text-amber-600">{generationDebug.duplicateRemoved}</b></span>
                        <span>Invalid Lineup: <b className="text-red-600">{generationDebug.invalidLineupRemoved}</b></span>
                        <span>Valid Teams: <b className="text-green-600">{generationDebug.validTeams}</b></span>
                        <span>Lineup: <b>{generationDebug.lineupMode}</b></span>
                        <span>Eligible: <b>{generationDebug.eligiblePlayers}/{generationDebug.totalPlayers}</b></span>
                        <span>Seed: <b>{generationDebug.seed}</b></span>
                      </div>
                    </div>
                  )}

                  {/* Fantasy Platform Transfer Buttons */}
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">3. Transfer to Fantasy Platform</p>
                    <div className="space-y-2">
                      {selectedMatch.fantasy_list.includes('dream11') && (
                        <Button
                          className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white h-11 text-sm font-semibold"
                          disabled={validTeams.length === 0}
                          onClick={() => {
                            setTransferPlatform('dream11')
                            setTransferOption('new')
                            setContestId('')
                            setShowTransferDialog(true)
                          }}
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Transfer to Dream11 {validTeams.length > 0 ? `(${validTeams.length} teams)` : ''}
                        </Button>
                      )}
                      {selectedMatch.fantasy_list.includes('my11circle') && (
                        <Button
                          className="w-full bg-[#2196f3] hover:bg-[#1e88e5] text-white h-11 text-sm font-semibold"
                          disabled={validTeams.length === 0}
                          onClick={() => {
                            setTransferPlatform('my11circle')
                            setTransferOption('new')
                            setContestId('')
                            setShowTransferDialog(true)
                          }}
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Transfer to My11Circle {validTeams.length > 0 ? `(${validTeams.length} teams)` : ''}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* JOIN CONTEST — Separate Module */}
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">4. Join Contest</p>
                    <Button
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-12 text-sm font-bold shadow-lg shadow-green-600/20"
                      disabled={validTeams.length === 0}
                      onClick={() => setShowJoinContestDialog(true)}
                    >
                      <Trophy className="w-5 h-5 mr-2" />
                      JOIN CONTEST {validTeams.length > 0 ? `(${validTeams.length} teams)` : ''}
                    </Button>
                    {validTeams.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">Generate teams first to join contests</p>
                    )}
                  </div>

                  {/* Fantasy Platform Info */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">Available Platforms</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedMatch.fantasy_list.map((fp) => (
                        <div key={fp} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                          <Globe className="w-3.5 h-3.5 text-[#6C63FF]" />
                          <span className="text-xs font-medium text-gray-700 capitalize">{fp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Match type info */}
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                <Info className="w-3.5 h-3.5" />
                <span>Match Type: <strong className="text-gray-700">{selectedMatch.match_type}</strong></span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ LOGIN DIALOG (Dream11/My11Circle OTP) ============ */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">
            Login to {loginPlatform}
          </DialogTitle>
          <button
            onClick={() => { setShowLoginDialog(false); setOtpSent(false); setMobileNumber(''); setOtp('') }}
            className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded-md z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="space-y-4">
            {/* Platform logo */}
            <div className="flex items-center gap-3">
              {loginPlatform === 'dream11' ? (
                <div className="w-12 h-12 rounded-xl bg-[#e74c3c] flex items-center justify-center text-white font-bold text-lg">D11</div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#2196f3] flex items-center justify-center text-white font-bold text-lg">M11</div>
              )}
              <div>
                <h3 className="text-lg font-bold text-gray-900">Link {loginPlatform === 'dream11' ? 'Dream11' : 'My11Circle'} Account</h3>
                <p className="text-sm text-gray-500">Link your fantasy platform account via OTP</p>
              </div>
            </div>

            {/* Google account status (if logged in) */}
            {authToken && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                <p className="text-sm text-green-700 font-medium">✓ Google account linked</p>
                {userProfile && <p className="text-xs text-green-600">{userProfile.name} ({userProfile.email})</p>}
              </div>
            )}

            {/* Google sign-in option (optional, if not logged in) */}
            {!authToken && (
              <div className="space-y-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                  <p className="text-xs text-blue-700 font-medium">💡 Optional: Sign in with Google for enhanced features</p>
                </div>
                <Button
                  className="w-full bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 h-10 text-sm font-semibold"
                  onClick={handleGoogleLogin}
                  disabled={otpVerifying}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.19 3.32v2.77h3.54c2.08-1.92 3.29-4.75 3.29-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.77c-.98.66-2.23 1.06-3.74 1.06-2.88 0-5.32-1.94-6.2-4.55H2.18v2.86C4 20.15 7.76 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.8 14.08A6.95 6.95 0 0 1 5.44 12c0-.72.13-1.42.36-2.08V7.06H2.18A11.01 11.01 0 0 0 1 12c0 1.8.43 3.49 1.18 4.98l3.62-2.9z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.76 1 4 3.87 2.18 7.06l3.62 2.86c.88-2.61 3.32-4.54 6.2-4.54z"/>
                  </svg>
                  Sign in with Google (optional)
                </Button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">OR LINK DIRECTLY</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              </div>
            )}

            {/* OTP Section - always visible */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">VERIFY MOBILE NUMBER</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Mobile number input */}
              {!otpSent ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 h-11">
                      <Phone className="w-4 h-4 text-gray-400 mr-1.5" />
                      <span className="text-sm text-gray-600">+91</span>
                    </div>
                    <input
                      type="tel"
                      placeholder="Enter mobile number"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="flex-1 h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent"
                      maxLength={10}
                    />
                  </div>
                  <Button
                    className="w-full bg-[#6C63FF] hover:bg-[#5B54E0] text-white h-11 text-sm font-semibold"
                    disabled={mobileNumber.length !== 10 || otpVerifying}
                    onClick={handleSendOTP}
                  >
                    {otpVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Send OTP
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-2">
                    <p className="text-sm text-green-700">OTP sent to +91 {mobileNumber}</p>
                  </div>
                  <input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm text-center tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent"
                    maxLength={6}
                  />
                  <Button
                    className="w-full bg-[#6C63FF] hover:bg-[#5B54E0] text-white h-11 text-sm font-semibold"
                    disabled={otp.length < 4 || otpVerifying}
                    onClick={handleVerifyOTP}
                  >
                    {otpVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Verify OTP & Link Account
                  </Button>
                  <button
                    onClick={() => { setOtpSent(false); setOtp('') }}
                    className="w-full text-xs text-[#6C63FF] hover:underline"
                  >
                    Change mobile number
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ TRANSFER DIALOG (New Team / Existing / Replace) ============ */}
      <Dialog open={showTransferDialog} onOpenChange={(open) => {
        if (!transferring) {
          setShowTransferDialog(open)
          if (!open) {
            setTransferProgress({ current: 0, total: 0, status: 'idle' })
            setTransferResults([])
            setTransferSuccessCount(0)
            setTransferFailCount(0)
            setExistingTeams([])
            setSelectedReplaceIds(new Set())
          }
        }
      }}>
        <DialogContent className="max-w-[90vw] max-h-[85vh] overflow-y-auto">
          <DialogTitle className="sr-only">
            Transfer to {transferPlatform}
          </DialogTitle>
          <button
            onClick={() => { if (!transferring) setShowTransferDialog(false) }}
            className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded-md z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="space-y-4">
            {/* Platform logo & title */}
            <div className="flex items-center gap-3">
              {transferPlatform === 'dream11' ? (
                <div className="w-12 h-12 rounded-xl bg-[#e74c3c] flex items-center justify-center text-white font-bold text-lg">D11</div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#2196f3] flex items-center justify-center text-white font-bold text-lg">M11</div>
              )}
              <div>
                <h3 className="text-lg font-bold text-gray-900">Transfer to {transferPlatform === 'dream11' ? 'Dream11' : 'My11Circle'}</h3>
                <p className="text-sm text-gray-500">{validTeams.length} teams ready to transfer</p>
              </div>
            </div>

            {/* Transfer is open — no license required */}

            {/* Auth status check */}
            {!fantasyAccounts[transferPlatform!]?.authToken ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 font-medium">⚠️ Link your {transferPlatform === 'dream11' ? 'Dream11' : 'My11Circle'} account first to transfer teams directly</p>
                <button
                  onClick={() => {
                    setShowTransferDialog(false)
                    setLoginPlatform(transferPlatform)
                    setShowLoginDialog(true)
                  }}
                  className="mt-2 text-sm text-[#6C63FF] font-semibold hover:underline flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Link via OTP →
                </button>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">{transferPlatform === 'dream11' ? 'Dream11' : 'My11Circle'} account linked</span>
                </div>
                <p className="text-xs text-green-600 mt-0.5 ml-6">+91 {fantasyAccounts[transferPlatform!]?.mobileNumber}</p>
              </div>
            )}

            {/* Transfer Options */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Transfer Option</p>

              {/* New Team Option */}
              <button
                onClick={() => setTransferOption('new')}
                disabled={transferring}
                className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${
                  transferOption === 'new'
                    ? 'border-[#6C63FF] bg-[#6C63FF]/5 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                } ${transferring ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    transferOption === 'new' ? 'bg-[#6C63FF] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${transferOption === 'new' ? 'text-[#6C63FF]' : 'text-gray-900'}`}>New Team</p>
                    <p className="text-xs text-gray-500 mt-0.5">Create {validTeams.length} new team{validTeams.length > 1 ? 's' : ''} on {transferPlatform === 'dream11' ? 'Dream11' : 'My11Circle'}</p>
                  </div>
                  {transferOption === 'new' && (
                    <CheckCircle2 className="w-5 h-5 text-[#6C63FF] shrink-0 ml-auto" />
                  )}
                </div>
              </button>

              {/* Existing Team Option */}
              <button
                onClick={() => setTransferOption('existing')}
                disabled={transferring}
                className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${
                  transferOption === 'existing'
                    ? 'border-[#00bfa5] bg-[#00bfa5]/5 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                } ${transferring ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    transferOption === 'existing' ? 'bg-[#00bfa5] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <BookmarkCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${transferOption === 'existing' ? 'text-[#00bfa5]' : 'text-gray-900'}`}>Existing Team</p>
                    <p className="text-xs text-gray-500 mt-0.5">Add players to your existing team{validTeams.length > 1 ? 's' : ''} on the platform</p>
                  </div>
                  {transferOption === 'existing' && (
                    <CheckCircle2 className="w-5 h-5 text-[#00bfa5] shrink-0 ml-auto" />
                  )}
                </div>
              </button>

              {/* Replace Team Option */}
              <button
                onClick={() => {
                  setTransferOption('replace')
                  // Auto-fetch existing teams when replace is selected
                  if (fantasyAccounts[transferPlatform!]?.authToken && existingTeams.length === 0) {
                    fetchExistingTeams()
                  }
                }}
                disabled={transferring}
                className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${
                  transferOption === 'replace'
                    ? 'border-[#f44336] bg-[#f44336]/5 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                } ${transferring ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    transferOption === 'replace' ? 'bg-[#f44336] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${transferOption === 'replace' ? 'text-[#f44336]' : 'text-gray-900'}`}>Replace Team</p>
                    <p className="text-xs text-gray-500 mt-0.5">Replace existing team{validTeams.length > 1 ? 's' : ''} with generated team{validTeams.length > 1 ? 's' : ''}</p>
                  </div>
                  {transferOption === 'replace' && (
                    <CheckCircle2 className="w-5 h-5 text-[#f44336] shrink-0 ml-auto" />
                  )}
                </div>
              </button>
            </div>


            {/* Replace Team: Existing Teams Selection UI */}
            {transferOption === 'replace' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Teams to Replace</p>
                  <button
                    onClick={fetchExistingTeams}
                    disabled={existingTeamsLoading || !fantasyAccounts[transferPlatform!]?.authToken}
                    className="text-xs text-[#6C63FF] font-medium hover:underline disabled:opacity-50"
                  >
                    {existingTeamsLoading ? 'Loading...' : 'Refresh list'}
                  </button>
                </div>

                {!fantasyAccounts[transferPlatform!]?.authToken ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
                    Link your {transferPlatform === 'dream11' ? 'Dream11' : 'My11Circle'} account first to see existing teams
                  </div>
                ) : existingTeamsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-[#6C63FF]" />
                    <span className="ml-2 text-sm text-gray-500">Loading existing teams...</span>
                  </div>
                ) : existingTeams.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <p className="text-sm text-gray-500">No existing teams found for this match</p>
                    <p className="text-xs text-gray-400 mt-1">Create teams first using &quot;New Team&quot; mode</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
                      Select up to {Math.min(validTeams.length, existingTeams.length)} existing team{Math.min(validTeams.length, existingTeams.length) > 1 ? 's' : ''} to replace with your generated teams
                    </div>
                    {/* Select All / Deselect All buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const maxSelectable = Math.min(validTeams.length, existingTeams.length)
                          const allIds = existingTeams.slice(0, maxSelectable).map(t => t.id)
                          setSelectedReplaceIds(new Set(allIds))
                        }}
                        disabled={selectedReplaceIds.size === Math.min(validTeams.length, existingTeams.length)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 border-[#f44336]/30 bg-[#f44336]/5 text-[#f44336] hover:bg-[#f44336]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Select All ({Math.min(validTeams.length, existingTeams.length)})
                      </button>
                      <button
                        onClick={() => setSelectedReplaceIds(new Set())}
                        disabled={selectedReplaceIds.size === 0}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Deselect All
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {existingTeams.map((team) => {
                        const isSelected = selectedReplaceIds.has(team.id)
                        const maxSelectable = Math.min(validTeams.length, existingTeams.length)
                        return (
                          <button
                            key={team.id}
                            onClick={() => {
                              setSelectedReplaceIds(prev => {
                                const next = new Set(prev)
                                if (next.has(team.id)) {
                                  next.delete(team.id)
                                } else if (next.size < maxSelectable) {
                                  next.add(team.id)
                                }
                                return next
                              })
                            }}
                            className={`w-full text-left rounded-lg border-2 p-2.5 transition-all ${
                              isSelected
                                ? 'border-[#f44336] bg-[#f44336]/5'
                                : selectedReplaceIds.size >= maxSelectable
                                  ? 'border-gray-200 bg-white opacity-50 cursor-not-allowed'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-[#f44336] bg-[#f44336]' : 'border-gray-300'
                              }`}>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{team.name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  {team.captain && <span>C: {team.captain}</span>}
                                  {team.players && <span>{team.players} players</span>}
                                  <span className="text-gray-400">ID: {team.id}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {selectedReplaceIds.size > 0 && (
                      <div className="bg-[#f44336]/5 border border-[#f44336]/20 rounded-lg p-2 text-xs">
                        <span className="text-[#f44336] font-semibold">{selectedReplaceIds.size}</span> of {Math.min(validTeams.length, existingTeams.length)} teams selected —
                        each selected team will be replaced by a generated team
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Transfer summary before start */}
            {transferProgress.status === 'idle' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Teams</span>
                  <span className="font-semibold text-gray-900">
                    {transferOption === 'replace' ? Math.min(selectedReplaceIds.size, validTeams.length) : validTeams.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">Mode</span>
                  <span className="font-semibold text-gray-900">
                    {transferOption === 'new' ? 'New Team' : transferOption === 'existing' ? 'Existing Team' : 'Replace Team'}
                  </span>
                </div>
                {transferOption === 'replace' && selectedReplaceIds.size > 0 && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Replacing</span>
                    <span className="font-semibold text-[#f44336]">{selectedReplaceIds.size} existing team{selectedReplaceIds.size > 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">Platform</span>
                  <span className="font-semibold text-gray-900">{transferPlatform === 'dream11' ? 'Dream11' : 'My11Circle'}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">Rate limit</span>
                  <span className="font-semibold text-gray-900">{transferPlatform === 'dream11' ? '200ms' : '2000ms'} between teams</span>
                </div>
              </div>
            )}

            {/* Live per-team progress during transfer */}
            {transferProgress.status === 'transferring' && (
              <div className="space-y-3">
                {/* Overall progress bar */}
                <div className="bg-[#6C63FF]/5 border border-[#6C63FF]/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#6C63FF]">Transferring teams...</span>
                    <span className="text-sm font-bold text-[#6C63FF]">{transferProgress.current}/{transferProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-[#6C63FF] h-3 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${(transferProgress.current / transferProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span className="text-green-600 font-medium">✓ {transferSuccessCount} success</span>
                    <span className="text-red-500 font-medium">✗ {transferFailCount} failed</span>
                  </div>
                </div>

                {/* Per-team status list (scrollable for many teams) */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {transferResults.map((result) => (
                    <div key={result.teamNumber} className="flex items-center gap-2 text-xs py-0.5">
                      {result.status === 'pending' && (
                        <div className="w-3.5 h-3.5 rounded-full bg-gray-200 shrink-0" />
                      )}
                      {result.status === 'processing' && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6C63FF] shrink-0" />
                      )}
                      {result.status === 'success' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      )}
                      {result.status === 'fail' && (
                        <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className={`font-medium ${
                        result.status === 'success' ? 'text-green-600' :
                        result.status === 'fail' ? 'text-red-500' :
                        result.status === 'processing' ? 'text-[#6C63FF]' :
                        'text-gray-400'
                      }`}>
                        Team {result.teamNumber}
                      </span>
                      {result.status === 'processing' && (
                        <span className="text-gray-400">Processing...</span>
                      )}
                      {result.status === 'fail' && result.message && (
                        <span className="text-red-400 truncate max-w-[200px]">- {result.message}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transfer Complete Summary */}
            {transferProgress.status === 'done' && (
              <div className="space-y-3">
                {transferFailCount === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">All Teams Transferred!</span>
                    </div>
                    <p className="text-sm text-green-600">
                      {transferSuccessCount} team{transferSuccessCount > 1 ? 's' : ''} successfully transferred to {transferPlatform === 'dream11' ? 'Dream11' : 'My11Circle'}
                    </p>
                  </div>
                ) : transferSuccessCount > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-700">Partial Transfer</span>
                    </div>
                    <p className="text-sm text-amber-600">
                      {transferSuccessCount} succeeded, {transferFailCount} failed out of {transferProgress.total} teams
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <X className="w-5 h-5 text-red-600" />
                      <span className="text-sm font-semibold text-red-700">Transfer Failed</span>
                    </div>
                    <p className="text-sm text-red-600">
                      All {transferFailCount} team transfers failed
                    </p>
                  </div>
                )}

                {/* Per-team results */}
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {transferResults.map((result) => (
                    <div key={result.teamNumber} className="flex items-center gap-2 text-xs py-0.5">
                      {result.status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className={result.status === 'success' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                        Team {result.teamNumber}
                      </span>
                      {result.status === 'fail' && result.message && (
                        <span className="text-red-400 truncate max-w-[200px]">- {result.message}</span>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full bg-[#6C63FF] hover:bg-[#5B54E0] text-white h-10 text-sm font-semibold"
                  onClick={() => {
                    setShowTransferDialog(false)
                    setTransferProgress({ current: 0, total: 0, status: 'idle' })
                    setTransferResults([])
                    setTransferSuccessCount(0)
                    setTransferFailCount(0)
                  }}
                >
                  Done
                </Button>
              </div>
            )}

            {/* Error state */}
            {transferProgress.status === 'error' && (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <X className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-semibold text-red-700">Cannot Transfer</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    Please link your {transferPlatform === 'dream11' ? 'Dream11' : 'My11Circle'} account first using OTP login.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-10 text-sm font-semibold"
                  onClick={() => {
                    setShowTransferDialog(false)
                    setLoginPlatform(transferPlatform)
                    setShowLoginDialog(true)
                    setTransferProgress({ current: 0, total: 0, status: 'idle' })
                  }}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Link {transferPlatform === 'dream11' ? 'Dream11' : 'My11Circle'} Account
                </Button>
              </div>
            )}

            {/* Transfer Button (shown before transfer starts) */}
            {transferProgress.status === 'idle' && (
              <Button
                className="w-full bg-[#6C63FF] hover:bg-[#5B54E0] text-white h-12 text-sm font-semibold"
                disabled={transferring || !fantasyAccounts[transferPlatform!]?.authToken || (transferOption === 'replace' && selectedReplaceIds.size === 0)}
                onClick={handleTransfer}
              >
                <Share2 className="w-4 h-4 mr-2" />
                {transferOption === 'replace'
                  ? `Replace ${selectedReplaceIds.size} Team${selectedReplaceIds.size !== 1 ? 's' : ''}`
                  : `Transfer ${validTeams.length} Team${validTeams.length > 1 ? 's' : ''} (${transferOption === 'new' ? 'New' : 'Existing'})`
                }
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ EXTRA TEAM PLAYER PICKER DIALOG ============ */}
      <Dialog open={extraPlayerPickerOpen !== null} onOpenChange={(open) => { if (!open) setExtraPlayerPickerOpen(null) }}>
        <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">
            Select Player
          </DialogTitle>
          <button
            onClick={() => setExtraPlayerPickerOpen(null)}
            className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded-md z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {matchDetail && extraPlayerPickerOpen && (
            <div className="space-y-3">
              {/* Title */}
              <div className="flex items-center gap-2">
                {extraPlayerPickerOpen === 'fix' && (
                  <>
                    <Users className="w-5 h-5 text-[#6C63FF]" />
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Select Fix Player {extraPlayerPickerSlot + 1}</h3>
                      <p className="text-xs text-gray-500">{extraFixedPlayers.length}/8 selected</p>
                    </div>
                  </>
                )}
                {extraPlayerPickerOpen === 'captain' && (
                  <>
                    <Crown className="w-5 h-5 text-yellow-500" />
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Select Captain {extraPlayerPickerSlot + 1}</h3>
                      <p className="text-xs text-gray-500">{extraCaptainOptions.length}/5 selected</p>
                    </div>
                  </>
                )}
                {extraPlayerPickerOpen === 'vicecaptain' && (
                  <>
                    <Crown className="w-5 h-5 text-gray-400" />
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Select Vice Captain {extraPlayerPickerSlot + 1}</h3>
                      <p className="text-xs text-gray-500">{extraViceCaptainOptions.length}/5 selected</p>
                    </div>
                  </>
                )}
                {extraPlayerPickerOpen === 'avoid' && (
                  <>
                    <Ban className="w-5 h-5 text-red-500" />
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Select Player to Avoid</h3>
                      <p className="text-xs text-gray-500">{extraAvoidPlayers.length} avoided</p>
                    </div>
                  </>
                )}
              </div>

              {/* Player list */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Left team players */}
                <div className="border-b border-gray-200">
                  <div className="px-2 py-1.5 bg-[#6C63FF]/5 text-[10px] font-bold text-[#6C63FF]">
                    {matchDetail.left_team_name}
                  </div>
                  {matchDetail.left_team_players.map(player => {
                    const isAlreadyFixed = extraFixedPlayers.some((p, i) => p.pl_id === player.pl_id && i !== (extraPlayerPickerOpen === 'fix' ? extraPlayerPickerSlot : -1))
                    const isAlreadyC = extraCaptainOptions.some((p, i) => p.pl_id === player.pl_id && i !== (extraPlayerPickerOpen === 'captain' ? extraPlayerPickerSlot : -1))
                    const isAlreadyVC = extraViceCaptainOptions.some((p, i) => p.pl_id === player.pl_id && i !== (extraPlayerPickerOpen === 'vicecaptain' ? extraPlayerPickerSlot : -1))
                    const isAlreadyAvoid = extraAvoidPlayers.some(p => p.pl_id === player.pl_id)
                    const isUsed = extraPlayerPickerOpen === 'fix'
                      ? isAlreadyFixed
                      : extraPlayerPickerOpen === 'captain'
                        ? isAlreadyC
                        : extraPlayerPickerOpen === 'vicecaptain'
                          ? isAlreadyVC
                          : extraPlayerPickerOpen === 'avoid'
                            ? isAlreadyAvoid
                            : false
                    // Lineup eligibility check
                    const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
                    const eligibility = isPlayerEligible(player, allPlayers, new Set(extraAvoidPlayers.map(p => p.pl_id)))
                    const isIneligible = !eligibility.eligible
                    const isDisabled = isUsed || isIneligible

                    return (
                      <button
                        key={player.pl_id}
                        onClick={() => {
                          if (extraPlayerPickerOpen === 'fix') {
                            if (!isAlreadyFixed || extraFixedPlayers[extraPlayerPickerSlot]?.pl_id === player.pl_id) {
                              setExtraFixedPlayers(prev => {
                                const next = [...prev]
                                next[extraPlayerPickerSlot] = player
                                return next
                              })
                              setExtraPlayerPickerOpen(null)
                            }
                          } else if (extraPlayerPickerOpen === 'captain') {
                            if (!isAlreadyC || extraCaptainOptions[extraPlayerPickerSlot]?.pl_id === player.pl_id) {
                              setExtraCaptainOptions(prev => {
                                const next = [...prev]
                                next[extraPlayerPickerSlot] = player
                                return next
                              })
                              setExtraPlayerPickerOpen(null)
                            }
                          } else if (extraPlayerPickerOpen === 'vicecaptain') {
                            if (!isAlreadyVC || extraViceCaptainOptions[extraPlayerPickerSlot]?.pl_id === player.pl_id) {
                              setExtraViceCaptainOptions(prev => {
                                const next = [...prev]
                                next[extraPlayerPickerSlot] = player
                                return next
                              })
                              setExtraPlayerPickerOpen(null)
                            }
                          } else if (extraPlayerPickerOpen === 'avoid') {
                            if (!isAlreadyAvoid) {
                              setExtraAvoidPlayers(prev => [...prev, player])
                              setExtraPlayerPickerOpen(null)
                            }
                          }
                        }}
                        disabled={isDisabled}
                        className={`w-full flex items-center gap-2 py-1.5 px-2 border-b border-gray-50 last:border-0 text-xs transition-colors ${
                          isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-[#6C63FF]/5 cursor-pointer'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                          <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-semibold truncate">{player.name}</p>
                          <div className="flex items-center gap-1">
                            <span className={`text-[8px] px-0.5 rounded border ${roleColor(player.role)}`}>
                              {getRoleShort(player.role)}
                            </span>
                            {isIneligible && (
                              <span className="text-[7px] font-bold text-red-500 bg-red-50 px-1 rounded">
                                {eligibility.reason}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 w-8">
                          <span className="font-medium">{player.credits}</span>
                        </div>
                        <div className="text-right flex-shrink-0 w-10">
                          <span className="text-gray-500">{player.selected_by}%</span>
                        </div>
                        {isUsed && <span className="text-[8px] text-gray-400 flex-shrink-0">used</span>}
                      </button>
                    )
                  })}
                </div>
                {/* Right team players */}
                <div>
                  <div className="px-2 py-1.5 bg-[#00D4AA]/5 text-[10px] font-bold text-[#00D4AA]">
                    {matchDetail.right_team_name}
                  </div>
                  {matchDetail.right_team_players.map(player => {
                    const isAlreadyFixed = extraFixedPlayers.some((p, i) => p.pl_id === player.pl_id && i !== (extraPlayerPickerOpen === 'fix' ? extraPlayerPickerSlot : -1))
                    const isAlreadyC = extraCaptainOptions.some((p, i) => p.pl_id === player.pl_id && i !== (extraPlayerPickerOpen === 'captain' ? extraPlayerPickerSlot : -1))
                    const isAlreadyVC = extraViceCaptainOptions.some((p, i) => p.pl_id === player.pl_id && i !== (extraPlayerPickerOpen === 'vicecaptain' ? extraPlayerPickerSlot : -1))
                    const isAlreadyAvoid = extraAvoidPlayers.some(p => p.pl_id === player.pl_id)
                    const isUsed = extraPlayerPickerOpen === 'fix'
                      ? isAlreadyFixed
                      : extraPlayerPickerOpen === 'captain'
                        ? isAlreadyC
                        : extraPlayerPickerOpen === 'vicecaptain'
                          ? isAlreadyVC
                          : extraPlayerPickerOpen === 'avoid'
                            ? isAlreadyAvoid
                            : false
                    // Lineup eligibility check
                    const allPlayers = [...matchDetail.left_team_players, ...matchDetail.right_team_players]
                    const eligibility = isPlayerEligible(player, allPlayers, new Set(extraAvoidPlayers.map(p => p.pl_id)))
                    const isIneligible = !eligibility.eligible
                    const isDisabled = isUsed || isIneligible

                    return (
                      <button
                        key={player.pl_id}
                        onClick={() => {
                          if (extraPlayerPickerOpen === 'fix') {
                            if (!isAlreadyFixed || extraFixedPlayers[extraPlayerPickerSlot]?.pl_id === player.pl_id) {
                              setExtraFixedPlayers(prev => {
                                const next = [...prev]
                                next[extraPlayerPickerSlot] = player
                                return next
                              })
                              setExtraPlayerPickerOpen(null)
                            }
                          } else if (extraPlayerPickerOpen === 'captain') {
                            if (!isAlreadyC || extraCaptainOptions[extraPlayerPickerSlot]?.pl_id === player.pl_id) {
                              setExtraCaptainOptions(prev => {
                                const next = [...prev]
                                next[extraPlayerPickerSlot] = player
                                return next
                              })
                              setExtraPlayerPickerOpen(null)
                            }
                          } else if (extraPlayerPickerOpen === 'vicecaptain') {
                            if (!isAlreadyVC || extraViceCaptainOptions[extraPlayerPickerSlot]?.pl_id === player.pl_id) {
                              setExtraViceCaptainOptions(prev => {
                                const next = [...prev]
                                next[extraPlayerPickerSlot] = player
                                return next
                              })
                              setExtraPlayerPickerOpen(null)
                            }
                          } else if (extraPlayerPickerOpen === 'avoid') {
                            if (!isAlreadyAvoid) {
                              setExtraAvoidPlayers(prev => [...prev, player])
                              setExtraPlayerPickerOpen(null)
                            }
                          }
                        }}
                        disabled={isDisabled}
                        className={`w-full flex items-center gap-2 py-1.5 px-2 border-b border-gray-50 last:border-0 text-xs transition-colors ${
                          isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-[#00D4AA]/5 cursor-pointer'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                          <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-semibold truncate">{player.name}</p>
                          <div className="flex items-center gap-1">
                            <span className={`text-[8px] px-0.5 rounded border ${roleColor(player.role)}`}>
                              {getRoleShort(player.role)}
                            </span>
                            {isIneligible && (
                              <span className="text-[7px] font-bold text-red-500 bg-red-50 px-1 rounded">
                                {eligibility.reason}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 w-8">
                          <span className="font-medium">{player.credits}</span>
                        </div>
                        <div className="text-right flex-shrink-0 w-10">
                          <span className="text-gray-500">{player.selected_by}%</span>
                        </div>
                        {isUsed && <span className="text-[8px] text-gray-400 flex-shrink-0">used</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ MODAL DIALOGS ============ */}
      <Dialog open={activeModal !== null} onOpenChange={(open) => { if (!open) setActiveModal(null) }}>
        <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">
            {activeModal ? SIDEBAR_ITEMS.find(i => i.modalKey === activeModal)?.name || 'Information' : 'Information'}
          </DialogTitle>
          <button
            onClick={() => setActiveModal(null)}
            className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded-md z-10"
          >
            <X className="w-4 h-4" />
          </button>
          {activeModal && MODAL_CONTENT[activeModal]?.()}
        </DialogContent>
      </Dialog>

      {/* ============ ADMIN LOGIN DIALOG ============ */}
      <Dialog open={showAdminLogin} onOpenChange={setShowAdminLogin}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="sr-only">Admin Login</DialogTitle>
          <div className="space-y-4 p-2">
            <div className="flex flex-col items-center gap-2">
              <Shield className="w-10 h-10 text-[#6C63FF]" />
              <h3 className="text-lg font-bold text-gray-900">ADMIN LOGIN</h3>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    if (!adminPassword) return
                    setAdminLoggingIn(true)
                    try {
                      const res = await fetch('/api/admin/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: adminPassword }),
                      })
                      const data = await res.json()
                      if (data.status === 'success') {
                        setAdminToken(data.data.token)
                        setShowAdminLogin(false)
                        setAdminPassword('')
                        setActiveModal('admin-dashboard')
                      } else {
                        toast({ title: 'Access denied', variant: 'destructive' })
                      }
                    } catch {
                      toast({ title: 'Login failed', variant: 'destructive' })
                    }
                    setAdminLoggingIn(false)
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6C63FF]"
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
            <Button
              onClick={async () => {
                if (!adminPassword) return
                setAdminLoggingIn(true)
                try {
                  const res = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: adminPassword }),
                  })
                  const data = await res.json()
                  if (data.status === 'success') {
                    setAdminToken(data.data.token)
                    setShowAdminLogin(false)
                    setAdminPassword('')
                    setActiveModal('admin-dashboard')
                  } else {
                    toast({ title: 'Access denied', variant: 'destructive' })
                  }
                } catch {
                  toast({ title: 'Login failed', variant: 'destructive' })
                }
                setAdminLoggingIn(false)
              }}
              disabled={adminLoggingIn || !adminPassword}
              className="w-full bg-[#6C63FF] hover:bg-[#5a52e0] text-white"
            >
              {adminLoggingIn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {adminLoggingIn ? 'Verifying...' : 'Login'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ ADMIN DASHBOARD DIALOG ============ */}
      <Dialog open={activeModal === 'admin-dashboard'} onOpenChange={(open) => { if (!open) { setActiveModal(null); setAdminToken(null); } }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Admin Dashboard</DialogTitle>
          <button onClick={() => { setActiveModal(null); setAdminToken(null); }} className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded-md z-10">
            <X className="w-4 h-4" />
          </button>
          <div className="p-2">
            {/* Admin Nav */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
              <div className="flex items-center gap-2 mr-4">
                <Shield className="w-5 h-5 text-[#6C63FF]" />
                <span className="font-bold text-sm">VYRON ADMIN</span>
              </div>
              {(['dashboard', 'licenses', 'logs', 'settings'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setAdminView(view)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${adminView === view ? 'bg-[#6C63FF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {view === 'dashboard' ? 'Dashboard' : view === 'licenses' ? 'Licenses' : view === 'logs' ? 'Transfer Logs' : 'Settings'}
                </button>
              ))}
            </div>

            {/* Dashboard View */}
            {adminView === 'dashboard' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#6C63FF]/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-[#6C63FF]">{adminLicenses.length || '-'}</p>
                    <p className="text-xs text-gray-500">Total Licenses</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{adminLicenses.filter(l => l.status === 'ACTIVE').length || '-'}</p>
                    <p className="text-xs text-gray-500">Active</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{adminLicenses.filter(l => l.status === 'INACTIVE').length || '-'}</p>
                    <p className="text-xs text-gray-500">Inactive</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{adminLicenses.filter(l => l.status === 'REVOKED' || l.status === 'EXPIRED').length || '-'}</p>
                    <p className="text-xs text-gray-500">Revoked/Expired</p>
                  </div>
                </div>
                <Button onClick={async () => { setAdminView('licenses'); /* load licenses */ }} variant="outline" className="w-full text-sm">Manage Licenses →</Button>
              </div>
            )}

            {/* Licenses View */}
            {adminView === 'licenses' && (
              <div className="space-y-4">
                {/* Create License */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Create New License</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Type</label>
                      <select
                        value={adminLicenseType}
                        onChange={(e) => setAdminLicenseType(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded-md text-xs"
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="THREE_MONTHS">3 Months</option>
                        <option value="SIX_MONTHS">6 Months</option>
                        <option value="LIFETIME">Lifetime</option>
                      </select>
                    </div>
                    <div className="w-20">
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Count</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={adminLicenseCount}
                        onChange={(e) => setAdminLicenseCount(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border rounded-md text-xs text-center"
                      />
                    </div>
                    <Button
                      onClick={async () => {
                        if (!adminToken) return
                        setAdminLicenseLoading(true)
                        try {
                          const res = await fetch('/api/admin/licenses/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                            body: JSON.stringify({ type: adminLicenseType, count: adminLicenseCount }),
                          })
                          const data = await res.json()
                          if (data.status === 'success') {
                            toast({ title: `✓ ${data.data.length} license(s) created` })
                            // Reload licenses
                            const listRes = await fetch('/api/admin/licenses', { headers: { 'Authorization': `Bearer ${adminToken}` } })
                            const listData = await listRes.json()
                            if (listData.status === 'success') setAdminLicenses(listData.data)
                          } else {
                            toast({ title: data.message || 'Failed', variant: 'destructive' })
                          }
                        } catch {
                          toast({ title: 'Error creating license', variant: 'destructive' })
                        }
                        setAdminLicenseLoading(false)
                      }}
                      disabled={adminLicenseLoading}
                      className="bg-[#6C63FF] hover:bg-[#5a52e0] text-white text-xs h-[30px] px-3"
                    >
                      Generate
                    </Button>
                  </div>
                </div>

                {/* Search */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={adminLicenseSearch}
                      onChange={(e) => setAdminLicenseSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border rounded-md text-xs"
                      placeholder="Search by key, account..."
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!adminToken) return
                      try {
                        const res = await fetch(`/api/admin/licenses?search=${encodeURIComponent(adminLicenseSearch)}`, {
                          headers: { 'Authorization': `Bearer ${adminToken}` },
                        })
                        const data = await res.json()
                        if (data.status === 'success') setAdminLicenses(data.data)
                      } catch {}
                    }}
                    variant="outline"
                    className="text-xs h-[30px] px-3"
                  >Search</Button>
                </div>

                {/* License List */}
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {adminLicenses.length === 0 ? (
                    <p className="text-center text-gray-400 text-xs py-8">No licenses yet. Create one above.</p>
                  ) : adminLicenses.map((lic) => (
                    <div key={lic.id} className="bg-white border rounded-lg p-2.5 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <code className="font-mono font-bold text-[11px] tracking-wider">{lic.key}</code>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${lic.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : lic.status === 'INACTIVE' ? 'bg-gray-100 text-gray-600' : lic.status === 'REVOKED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{lic.status}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span>{lic.type === 'THREE_MONTHS' ? '3M' : lic.type === 'SIX_MONTHS' ? '6M' : lic.type === 'LIFETIME' ? 'LT' : '1M'}</span>
                        <span>Created: {new Date(lic.createdAt).toLocaleDateString()}</span>
                        {lic.activatedAt && <span>Act: {new Date(lic.activatedAt).toLocaleDateString()}</span>}
                        {lic.expiresAt ? <span>Exp: {new Date(lic.expiresAt).toLocaleDateString()}</span> : lic.type === 'LIFETIME' && <span>Never expires</span>}
                        {lic.assignedTo && <span>User: {lic.assignedTo}</span>}
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {lic.status === 'INACTIVE' && (
                          <button onClick={async () => {
                            if (!adminToken) return
                            try {
                              const res = await fetch('/api/admin/licenses/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ id: lic.id, action: 'activate' }) })
                              const data = await res.json()
                              if (data.status === 'success') {
                                toast({ title: '✓ License activated' })
                                const listRes = await fetch('/api/admin/licenses', { headers: { 'Authorization': `Bearer ${adminToken}` } })
                                const listData = await listRes.json()
                                if (listData.status === 'success') setAdminLicenses(listData.data)
                              }
                            } catch {}
                          }} className="px-2 py-0.5 bg-green-500 text-white rounded text-[10px] font-semibold hover:bg-green-600">Activate</button>
                        )}
                        {lic.status === 'ACTIVE' && (
                          <button onClick={async () => {
                            if (!adminToken) return
                            try {
                              const res = await fetch('/api/admin/licenses/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ id: lic.id, action: 'revoke' }) })
                              const data = await res.json()
                              if (data.status === 'success') {
                                toast({ title: 'License revoked' })
                                const listRes = await fetch('/api/admin/licenses', { headers: { 'Authorization': `Bearer ${adminToken}` } })
                                const listData = await listRes.json()
                                if (listData.status === 'success') setAdminLicenses(listData.data)
                              }
                            } catch {}
                          }} className="px-2 py-0.5 bg-red-500 text-white rounded text-[10px] font-semibold hover:bg-red-600">Revoke</button>
                        )}
                        {lic.status === 'ACTIVE' && (
                          <button onClick={async () => {
                            if (!adminToken) return
                            try {
                              const res = await fetch('/api/admin/licenses/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ id: lic.id, action: 'deactivate' }) })
                              const data = await res.json()
                              if (data.status === 'success') {
                                toast({ title: 'License deactivated' })
                                const listRes = await fetch('/api/admin/licenses', { headers: { 'Authorization': `Bearer ${adminToken}` } })
                                const listData = await listRes.json()
                                if (listData.status === 'success') setAdminLicenses(listData.data)
                              }
                            } catch {}
                          }} className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-semibold hover:bg-amber-600">Deactivate</button>
                        )}
                        <button onClick={async () => {
                          if (!confirm('Delete this license?')) return
                          if (!adminToken) return
                          try {
                            const res = await fetch('/api/admin/licenses/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ id: lic.id, action: 'delete' }) })
                            const data = await res.json()
                            if (data.status === 'success') {
                              toast({ title: 'License deleted' })
                              setAdminLicenses(prev => prev.filter(l => l.id !== lic.id))
                            }
                          } catch {}
                        }} className="px-2 py-0.5 bg-gray-500 text-white rounded text-[10px] font-semibold hover:bg-gray-600">Delete</button>
                        <button onClick={() => { navigator.clipboard.writeText(lic.key); toast({ title: 'Key copied!' }) }} className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px] font-semibold hover:bg-gray-300">Copy</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transfer Logs View */}
            {adminView === 'logs' && (
              <div className="space-y-3">
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {adminTransferLogs.length === 0 ? (
                    <p className="text-center text-gray-400 text-xs py-8">No transfer logs yet</p>
                  ) : adminTransferLogs.map((log) => (
                    <div key={log.id} className="bg-white border rounded-lg p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{log.platform} • {log.transferType}</span>
                        <span className="text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-gray-500 mt-1">
                        Match: {log.matchId} | Teams: {log.teamCount} | ✓{log.successCount} ✗{log.failCount}
                        {log.performedBy && ` | By: ${log.performedBy}`}
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={async () => {
                  if (!adminToken) return
                  try {
                    const res = await fetch('/api/admin/transfer-logs', { headers: { 'Authorization': `Bearer ${adminToken}` } })
                    const data = await res.json()
                    if (data.status === 'success') setAdminTransferLogs(data.data.logs)
                  } catch {}
                }} variant="outline" className="w-full text-xs">Load Logs</Button>
              </div>
            )}

            {/* Settings View */}
            {adminView === 'settings' && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p className="font-semibold mb-2">System Info</p>
                  <p>Admin session expires in 4 hours</p>
                  <p>License types: Monthly, 3 Months, 6 Months, Lifetime</p>
                  <p>Transfer requires active license: Yes</p>
                </div>
                <Button onClick={() => { setAdminToken(null); setActiveModal(null); toast({ title: 'Logged out' }); }} variant="outline" className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50">Logout Admin</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* JOIN CONTEST — Completely Separate Module */}
      <JoinContestDialog
        open={showJoinContestDialog}
        onClose={() => setShowJoinContestDialog(false)}
        matches={matches.map(m => ({
          id: m.id,
          left_team_name: m.left_team_name,
          right_team_name: m.right_team_name,
          match_time: m.match_time,
          sport_index: m.sport_index,
          lineup_out: m.lineup_out,
          fantasy_list: m.fantasy_list,
        }))}
        fantasyAccounts={fantasyAccounts}
        onAccountUpdate={(platform, account) => {
          setFantasyAccounts(prev => {
            const updated = { ...prev, [platform]: account }
            localStorage.setItem('vyron_fantasy_accounts', JSON.stringify(updated))
            return updated
          })
        }}
      />
    </div>
    </>
  )
}
