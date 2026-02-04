# Friends Feature - Concept Document

## Overview
Private friend competitions and leaderboards to increase engagement through social accountability.

## Core Features

### 1. Friend Connections
- **Add by username**: Search and send friend request
- **Add by email**: Send invite link to non-users (referral growth)
- **Accept/decline**: Simple request management
- **Remove friends**: Privacy control

### 2. Private Leaderboards
- **Friend-only view**: Filter global leaderboard to friends
- **Weekly competitions**: Auto-reset weekly friend leaderboards
- **Challenge mode**: "Beat my score" direct challenges

### 3. Social Features
- **Activity feed**: See friends' achievements and milestones
- **Cheers/reactions**: Simple emoji reactions to friend activities
- **Streak comparisons**: Side-by-side streak viewing

### 4. Privacy Controls
- **Opt-in only**: Friends feature entirely optional
- **Visibility settings**: Control what friends can see
- **Block users**: Prevent unwanted connections

## Technical Considerations

### Database Schema Addition
```sql
-- Friend relationships
FriendRequest (id, fromUserId, toUserId, status, createdAt)
Friendship (id, userId1, userId2, createdAt)

-- Friend activity feed
FriendActivity (id, userId, activityType, metadata, createdAt)
```

### API Endpoints Needed
- `POST /api/friends/request` - Send friend request
- `GET /api/friends` - List friends
- `GET /api/friends/leaderboard` - Friend-only leaderboard
- `GET /api/friends/activity` - Activity feed

## Future Enhancements
- Friend groups/teams
- Private tournaments
- Shared study sessions
- Gift achievements (celebrate friend milestones)

## Notes
- Start with MVP: Add by username + private leaderboard only
- Consider integration with existing Daily Challenge streak sharing
- Could leverage for referral program tracking
