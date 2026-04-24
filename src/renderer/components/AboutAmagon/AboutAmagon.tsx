import {useEffect} from 'react'
import {ExternalLink, Heart, Info, Star, X} from 'lucide-react'
import appLogo from '../../../../assets/app.png'
import './AboutAmagon.css'

interface AboutAmagonProps {
    isOpen: boolean
    onClose: () => void
}

export default function AboutAmagon({ isOpen, onClose }: AboutAmagonProps): JSX.Element | null {
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="about-overlay" onClick={onClose}>
            <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="about-header">
                    <h2><Info size={20} /> About Amagon</h2>
                    <button className="about-close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="about-content">
                    <div className="about-brand">
                        <div className="about-logo">
                            <img src={appLogo} alt="Amagon Logo" />
                        </div>
                        <h3>Amagon HTML Editor</h3>
                    </div>

                    <p className="about-description">
                        An offline, AI-powered visual HTML editor — a Pingendo/Mobirise/Bootstrap Studio alternative for Linux.
                    </p>

                    <p className="about-description">
                        <strong>Amagon</strong> is derived from the Cebuano (Bisaya) word <em>Amag</em>, which means "to glow" or "luminescence". Like a glowing phosphor in a dark terminal, Amagon is designed to illuminate the path between visual design and high-performance code, allowing you to create websites within minutes.
                    </p>

                    <div className="about-author">
                        <h4>Maintained by Richard Orilla</h4>
                        <a href="https://github.com/Shin-Aska" target="_blank" rel="noopener noreferrer" className="about-link">
                            <ExternalLink size={16} /> GitHub Profile
                        </a>
                    </div>

                    <div className="about-support">
                        <h4>Support the Developer</h4>
                        <p>If you wish to support the developer, starring the repository will do:</p>
                        <a href="https://github.com/Shin-Aska/amagon-html-editor" target="_blank" rel="noopener noreferrer" className="about-link support-btn star-btn">
                            <Star size={16} /> Star on GitHub
                        </a>
                        <p>But if you want to support financially, pay here:</p>
                        <a href="https://github.com/sponsors/Shin-Aska" target="_blank" rel="noopener noreferrer" className="about-link support-btn sponsor-btn">
                            <Heart size={16} /> Sponsor via GitHub
                        </a>
                    </div>
                </div>

                <div className="about-footer">
                    <p>Press <kbd>Escape</kbd> to close this dialog</p>
                </div>
            </div>
        </div>
    )
}
