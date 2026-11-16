// «دبدوب»: an original teddy-bear cub who loves sweets. He blinks, claps his paws, tilts his head
// to watch a demonstration, waves on the start screen. He never looks sad.
/** `lean`: leaning in to count with her (training). `hush`: a step back, paw over his mouth (competition). */
export type BearMood = 'idle' | 'clap' | 'watch' | 'wave' | 'hop' | 'lean' | 'hush'

export function Bear({ mood = 'idle', className = '' }: { mood?: BearMood; className?: string }) {
  return (
    <svg className={`bear bear-${mood} ${className}`} viewBox="0 0 120 134" aria-hidden="true">
      <defs>
        <radialGradient id="bear-fur" cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#f2b56a" />
          <stop offset=".7" stopColor="#e09a4c" />
          <stop offset="1" stopColor="#c47a34" />
        </radialGradient>
        <radialGradient id="bear-body" cx="50%" cy="30%" r="80%">
          <stop offset="0" stopColor="#efac5f" />
          <stop offset="1" stopColor="#c47a34" />
        </radialGradient>
      </defs>
      <ellipse className="bear-shadow" cx="60" cy="130" rx="34" ry="4" fill="#3a2318" opacity=".14" />
      <g className="bear-feet">
        <ellipse cx="43" cy="124" rx="12" ry="7" fill="url(#bear-body)" />
        <ellipse cx="77" cy="124" rx="12" ry="7" fill="url(#bear-body)" />
        <ellipse cx="43" cy="124.5" rx="6" ry="3.6" fill="#f7c0a8" />
        <ellipse cx="77" cy="124.5" rx="6" ry="3.6" fill="#f7c0a8" />
      </g>
      <g className="bear-torso">
        <ellipse cx="60" cy="106" rx="29" ry="22" fill="url(#bear-body)" />
        <ellipse cx="60" cy="110" rx="16.5" ry="13" fill="#fbe5c8" />
      </g>
      <g className="bear-paw bear-paw-r">
        <ellipse cx="33" cy="101" rx="9.5" ry="14" transform="rotate(28 33 101)" fill="url(#bear-body)" />
        <ellipse cx="29" cy="110" rx="5" ry="4.2" fill="#f7c0a8" />
      </g>
      <g className="bear-paw bear-paw-l">
        <ellipse cx="87" cy="101" rx="9.5" ry="14" transform="rotate(-28 87 101)" fill="url(#bear-body)" />
        <ellipse cx="91" cy="110" rx="5" ry="4.2" fill="#f7c0a8" />
      </g>
      <g className="bear-head">
        <circle cx="30" cy="26" r="15" fill="url(#bear-fur)" />
        <circle cx="90" cy="26" r="15" fill="url(#bear-fur)" />
        <circle cx="30" cy="27" r="8" fill="#f7b9a6" />
        <circle cx="90" cy="27" r="8" fill="#f7b9a6" />
        <ellipse cx="60" cy="52" rx="40" ry="35" fill="url(#bear-fur)" />
        <ellipse cx="60" cy="66" rx="17" ry="12.5" fill="#fbe5c8" />
        <circle className="bear-cheek" cx="33" cy="64" r="6.5" fill="#ff8fb1" opacity=".45" />
        <circle className="bear-cheek" cx="87" cy="64" r="6.5" fill="#ff8fb1" opacity=".45" />
        <g className="bear-eyes">
          <g className="bear-eye">
            <ellipse cx="44" cy="47" rx="7.6" ry="8.6" fill="#fff" />
            <circle className="bear-pupil" cx="45" cy="48.5" r="5.4" fill="#3a2318" />
            <circle cx="46.8" cy="46" r="1.9" fill="#fff" />
          </g>
          <g className="bear-eye">
            <ellipse cx="76" cy="47" rx="7.6" ry="8.6" fill="#fff" />
            <circle className="bear-pupil" cx="75" cy="48.5" r="5.4" fill="#3a2318" />
            <circle cx="76.8" cy="46" r="1.9" fill="#fff" />
          </g>
        </g>
        <path d="M54.5 59.5c0-2.4 11-2.4 11 0 0 2.4-3.4 4.6-5.5 4.6s-5.5-2.2-5.5-4.6z" fill="#3a2318" />
        <ellipse cx="58" cy="59.6" rx="2" ry="1" fill="#fff" opacity=".55" />
        <path className="bear-mouth" d="M60 64v2.4M60 66.4c-1.6 2.6-5 2.8-6.6 1M60 66.4c1.6 2.6 5 2.8 6.6 1" fill="none" stroke="#3a2318" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      {mood === 'hush' ? (
        // A paw over his mouth: he is not allowed to count in a competition.
        <g className="bear-hush-paw">
          <path d="M84 104c-6-14-12-26-20-34" fill="none" stroke="#c47a34" strokeWidth="15" strokeLinecap="round" />
          <ellipse cx="61" cy="66" rx="14" ry="10.5" fill="url(#bear-body)" stroke="#a9692c" strokeWidth="1.2" />
          <ellipse cx="61" cy="68" rx="6.5" ry="4.4" fill="#f7c0a8" />
          <circle cx="53" cy="61" r="2.4" fill="#f7c0a8" />
          <circle cx="60" cy="59.4" r="2.4" fill="#f7c0a8" />
          <circle cx="67" cy="61" r="2.4" fill="#f7c0a8" />
        </g>
      ) : null}
      <g className="bear-bow">
        <path d="M60 86l-11-6c-2-1-3.5 0-3.5 2v8c0 2 1.5 3 3.5 2z" fill="#ff8fb1" />
        <path d="M60 86l11-6c2-1 3.5 0 3.5 2v8c0 2-1.5 3-3.5 2z" fill="#ff8fb1" />
        <circle cx="60" cy="86" r="3.6" fill="#e0457b" />
      </g>
    </svg>
  )
}
